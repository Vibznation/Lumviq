import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockProvider = {
  name: 'sandbox',
  isConfigured: () => true,
  calculatePayroll: vi.fn(),
  createOffCyclePayroll: vi.fn(),
  approvePayroll: vi.fn(),
  cancelPayroll: vi.fn(),
  voidPayroll: vi.fn(),
  retrievePayroll: vi.fn(),
}

vi.mock('../src/lib/integrations/payroll-sandbox', () => ({
  getPayrollProvider: () => (mockProviderEnabled ? mockProvider : undefined),
}))

let mockProviderEnabled = true

import {
  calculatePayRun,
  submitPayRunForApproval,
  submitApprovedPayRun,
  syncPayRunStatus,
  cancelPayRun,
  voidPayRun,
  isProviderConnected,
  PayrollProviderNotConnectedError,
} from '../src/lib/payroll-run'

function makeTx(overrides: Partial<Record<string, any>> = {}) {
  const payRunStore: Record<string, any> = {}
  return {
    payRun: {
      findUnique: vi.fn(async ({ where }: any) => payRunStore[where.id] ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        payRunStore[where.id] = { ...payRunStore[where.id], ...data }
        return payRunStore[where.id]
      }),
    },
    payRunLine: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    approval: {
      create: vi.fn(async ({ data }: any) => ({ id: 'appr1', ...data })),
    },
    auditEvent: { create: vi.fn(async () => ({})) },
    notification: { create: vi.fn(async () => ({})) },
    __store: payRunStore,
    ...overrides,
  }
}

const payPeriodStart = new Date('2026-01-01')
const payPeriodEnd = new Date('2026-01-15')

describe('payroll-run.ts', () => {
  beforeEach(() => {
    mockProviderEnabled = true
    vi.clearAllMocks()
  })

  it('isProviderConnected reflects mock provider state', () => {
    mockProviderEnabled = true
    expect(isProviderConnected()).toBe(true)
    mockProviderEnabled = false
    expect(isProviderConnected()).toBe(false)
  })

  it('calculatePayRun throws PayrollProviderNotConnectedError when no provider is connected', async () => {
    mockProviderEnabled = false
    const tx = makeTx()
    tx.__store['pr1'] = { id: 'pr1', organizationId: 'org', status: 'draft', payPeriodStart, payPeriodEnd, lines: [] }
    await expect(calculatePayRun(tx as any, 'pr1', 'actor1')).rejects.toThrow(PayrollProviderNotConnectedError)
  })

  it('calculatePayRun updates the pay run and lines from the provider result', async () => {
    const tx = makeTx()
    tx.__store['pr1'] = {
      id: 'pr1', organizationId: 'org', status: 'draft', offCycle: false,
      payPeriodStart, payPeriodEnd, lines: [{ employeeId: 'emp1', grossPay: '1000', reimbursements: '0' }],
    }
    mockProvider.calculatePayroll.mockResolvedValue({
      providerPayrollId: 'run1',
      status: 'calculated',
      totalGross: '1000.00',
      totalEmployeeTax: '150.00',
      totalEmployerTax: '80.00',
      totalPretaxDeductions: '0.00',
      totalPosttaxDeductions: '0.00',
      totalReimbursements: '0.00',
      totalNetPay: '850.00',
      debitDate: '2026-01-15',
      employeePaymentDate: '2026-01-15',
      lines: [{
        employeeExternalId: 'emp1', grossPay: '1000.00', pretaxDeductions: '0.00', employeeTax: '150.00',
        posttaxDeductions: '0.00', garnishments: '0.00', reimbursements: '0.00', netPay: '850.00',
        employerTax: '80.00', employerBenefitsCost: '0.00',
      }],
      warnings: [],
    })

    const { payRun, warnings } = await calculatePayRun(tx as any, 'pr1', 'actor1')
    expect(payRun.status).toBe('calculated')
    expect(payRun.providerPayrollId).toBe('run1')
    expect(warnings).toEqual([])
    expect(tx.payRunLine.updateMany).toHaveBeenCalled()
  })

  it('calculatePayRun rejects a pay run that is not draft/needs_attention', async () => {
    const tx = makeTx()
    tx.__store['pr1'] = { id: 'pr1', organizationId: 'org', status: 'submitted', payPeriodStart, payPeriodEnd, lines: [] }
    await expect(calculatePayRun(tx as any, 'pr1', 'actor1')).rejects.toThrow(/draft or needs_attention/)
  })

  it('submitPayRunForApproval moves a calculated run to awaiting_approval and creates an approval', async () => {
    const tx = makeTx()
    tx.__store['pr1'] = {
      id: 'pr1', organizationId: 'org', status: 'calculated', preparedByUserId: 'preparer1',
      totalNetPay: '850.00', totalEmployerTax: '80.00', totalEmployerBenefitsCost: '0.00',
      payPeriodStart, payPeriodEnd,
    }
    const { payRun, approval } = await submitPayRunForApproval(tx as any, 'pr1', 'preparer1')
    expect(payRun.status).toBe('awaiting_approval')
    expect(approval.requestedByUserId).toBe('preparer1')
    expect(approval.resourceType).toBe('payroll-run')
  })

  it('submitApprovedPayRun calls provider.approvePayroll and advances status', async () => {
    const tx = makeTx()
    tx.__store['pr1'] = { id: 'pr1', organizationId: 'org', status: 'awaiting_approval', providerPayrollId: 'run1' }
    mockProvider.approvePayroll.mockResolvedValue({ providerPayrollId: 'run1', status: 'submitted' })

    const updated = await submitApprovedPayRun(tx as any, 'pr1', 'approver1')
    expect(mockProvider.approvePayroll).toHaveBeenCalledWith('run1')
    expect(updated.status).toBe('submitted')
    expect(updated.approvedByUserId).toBe('approver1')
  })

  it('syncPayRunStatus posts to the ledger once the provider reports paid', async () => {
    const journalEntry = { id: 'je1' }
    const tx = makeTx({
      journalEntry: { findUnique: vi.fn(), create: vi.fn(async () => journalEntry) },
      account: {
        findFirst: vi.fn(async ({ where }: any) =>
          ({ payroll_expense: { id: 'exp1' }, payroll_liability: { id: 'liab1' } } as any)[where.subtype] || null
        ),
      },
    })
    tx.__store['pr1'] = {
      id: 'pr1', organizationId: 'org', status: 'submitted', providerPayrollId: 'run1',
      journalEntryId: null, totalGross: '1000', totalEmployeeTax: '0', totalEmployerTax: '0',
      payPeriodStart, payPeriodEnd, lines: [],
    }
    mockProvider.retrievePayroll.mockResolvedValue({ providerPayrollId: 'run1', status: 'paid' })

    const updated = await syncPayRunStatus(tx as any, 'pr1', 'actor1')
    expect(updated.status).toBe('completed')
    expect(updated.journalEntryId).toBe('je1')
  })

  it('cancelPayRun cancels a not-yet-submitted run and calls provider.cancelPayroll if applicable', async () => {
    const tx = makeTx()
    tx.__store['pr1'] = { id: 'pr1', organizationId: 'org', status: 'calculated', providerPayrollId: 'run1' }
    mockProvider.cancelPayroll.mockResolvedValue({ providerPayrollId: 'run1', status: 'failed' })
    const updated = await cancelPayRun(tx as any, 'pr1', 'actor1')
    expect(updated.status).toBe('cancelled')
    expect(mockProvider.cancelPayroll).toHaveBeenCalledWith('run1')
  })

  it('cancelPayRun rejects a run that has already been submitted', async () => {
    const tx = makeTx()
    tx.__store['pr1'] = { id: 'pr1', organizationId: 'org', status: 'submitted', providerPayrollId: 'run1' }
    await expect(cancelPayRun(tx as any, 'pr1', 'actor1')).rejects.toThrow(/not been submitted/)
  })

  it('voidPayRun voids a submitted/processing run via the provider', async () => {
    const tx = makeTx()
    tx.__store['pr1'] = { id: 'pr1', organizationId: 'org', status: 'processing', providerPayrollId: 'run1' }
    mockProvider.voidPayroll.mockResolvedValue({ providerPayrollId: 'run1', status: 'failed' })
    const updated = await voidPayRun(tx as any, 'pr1', 'actor1')
    expect(updated.status).toBe('voided')
    expect(mockProvider.voidPayroll).toHaveBeenCalledWith('run1')
  })
})
