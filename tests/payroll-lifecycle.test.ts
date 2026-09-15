/**
 * Proof-of-completion: the full sandbox-provider payroll lifecycle —
 * calculate -> submit for approval -> approve -> sync (posts to the
 * ledger + generates a paystub) -> reverse — with explicit checks that
 * (a) the resulting journal entries are balanced (debits === credits)
 * and (b) ledger posting / paystub generation / reversal are all
 * idempotent (re-running does not duplicate side effects).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { isBalanced } from '../src/lib/ledger'

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
  getPayrollProvider: () => mockProvider,
}))

import { calculatePayRun, submitPayRunForApproval, submitApprovedPayRun, syncPayRunStatus, reversePayRun } from '../src/lib/payroll-run'

const ORG = randomUUID()
const EXPENSE_ACCOUNT = randomUUID()
const LIABILITY_ACCOUNT = randomUUID()
const TAX_EXPENSE_ACCOUNT = randomUUID()
const TAX_LIABILITY_ACCOUNT = randomUUID()

function makeFullTx() {
  const payRunStore: Record<string, any> = {}
  const payStubStore: Record<string, any> = {}
  const journalEntries: Record<string, any> = {}
  const journalEntriesByIdempotencyKey: Record<string, any> = {}
  const accounts: Record<string, any> = {
    payroll_expense: { id: EXPENSE_ACCOUNT },
    payroll_liability: { id: LIABILITY_ACCOUNT },
    payroll_tax_expense: { id: TAX_EXPENSE_ACCOUNT },
    payroll_tax_liability: { id: TAX_LIABILITY_ACCOUNT },
  }

  const journalEntryCreate = vi.fn(async ({ data }: any) => {
    const entry = { id: `je-${randomUUID()}`, ...data, lines: (data.lines?.create ?? []).map((l: any, i: number) => ({ id: `jl-${i}`, ...l })) }
    journalEntries[entry.id] = entry
    if (data.idempotencyKey) journalEntriesByIdempotencyKey[data.idempotencyKey] = entry
    return entry
  })

  return {
    payRun: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id) return payRunStore[where.id] ?? null
        if (where.reversalOfPayRunId) {
          return Object.values(payRunStore).find((p: any) => p.reversalOfPayRunId === where.reversalOfPayRunId) ?? null
        }
        return null
      }),
      update: vi.fn(async ({ where, data }: any) => {
        payRunStore[where.id] = { ...payRunStore[where.id], ...data }
        return payRunStore[where.id]
      }),
      create: vi.fn(async ({ data }: any) => {
        const id = `pr-${randomUUID()}`
        const row = { id, ...data }
        payRunStore[id] = row
        return row
      }),
    },
    payRunLine: {
      updateMany: vi.fn(async ({ where, data }: any) => {
        const line = payRunStore['pr1'].lines.find((l: any) => l.employeeId === where.employeeId)
        if (line) Object.assign(line, data)
        return { count: line ? 1 : 0 }
      }),
    },
    payStub: {
      findUnique: vi.fn(async ({ where }: any) => payStubStore[where.payRunLineId] ?? null),
      create: vi.fn(async ({ data }: any) => {
        const stub = { id: `stub-${randomUUID()}`, ...data }
        payStubStore[data.payRunLineId] = stub
        return stub
      }),
    },
    account: {
      findFirst: vi.fn(async ({ where }: any) => accounts[where.subtype] ?? null),
    },
    journalEntry: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id) return journalEntries[where.id] ?? null
        if (where.idempotencyKey) return journalEntriesByIdempotencyKey[where.idempotencyKey] ?? null
        return null
      }),
      create: journalEntryCreate,
    },
    accountingPeriod: { findFirst: vi.fn(async () => null) },
    approval: { create: vi.fn(async ({ data }: any) => ({ id: 'appr1', ...data })) },
    auditEvent: { create: vi.fn(async () => ({})) },
    notification: { create: vi.fn(async () => ({})) },
    __store: payRunStore,
    __payStubs: payStubStore,
    __journalEntries: journalEntries,
  }
}

const payPeriodStart = new Date('2026-01-01')
const payPeriodEnd = new Date('2026-01-15')

describe('full payroll lifecycle (proof of completion)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calculate -> submit -> approve -> sync produces a paystub AND a balanced journal entry', async () => {
    const tx = makeFullTx()
    tx.__store['pr1'] = {
      id: 'pr1', organizationId: ORG, status: 'draft', offCycle: false,
      payPeriodStart, payPeriodEnd,
      lines: [{ id: 'line1', employeeId: 'emp1', grossPay: '1000', reimbursements: '0' }],
    }

    mockProvider.calculatePayroll.mockResolvedValue({
      providerPayrollId: 'run1', status: 'calculated',
      totalGross: '1000.00', totalEmployeeTax: '150.00', totalEmployerTax: '80.00',
      totalPretaxDeductions: '0.00', totalPosttaxDeductions: '0.00', totalReimbursements: '0.00',
      totalNetPay: '850.00', debitDate: '2026-01-15', employeePaymentDate: '2026-01-15',
      lines: [{
        employeeExternalId: 'emp1', grossPay: '1000.00', pretaxDeductions: '0.00', employeeTax: '150.00',
        posttaxDeductions: '0.00', garnishments: '0.00', reimbursements: '0.00', netPay: '850.00',
        employerTax: '80.00', employerBenefitsCost: '0.00',
      }],
      warnings: [],
    })
    const { payRun: calculated } = await calculatePayRun(tx as any, 'pr1', 'preparer1')
    expect(calculated.status).toBe('calculated')

    const { payRun: submitted, approval } = await submitPayRunForApproval(tx as any, 'pr1', 'preparer1')
    expect(submitted.status).toBe('awaiting_approval')
    expect(approval.resourceType).toBe('payroll-run')

    mockProvider.approvePayroll.mockResolvedValue({ providerPayrollId: 'run1', status: 'submitted' })
    const approved = await submitApprovedPayRun(tx as any, 'pr1', 'approver1')
    expect(approved.status).toBe('submitted')
    expect(approved.approvedByUserId).toBe('approver1')

    mockProvider.retrievePayroll.mockResolvedValue({ providerPayrollId: 'run1', status: 'paid' })
    const synced = await syncPayRunStatus(tx as any, 'pr1', 'actor1')

    expect(synced.status).toBe('completed')
    expect(synced.journalEntryId).toBeTruthy()

    // A paystub was generated for the employee's pay-run line.
    expect(tx.payStub.create).toHaveBeenCalledTimes(1)
    expect(tx.payStub.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ payRunId: 'pr1', payRunLineId: 'line1', employeeId: 'emp1' }),
    }))

    // The posted journal entry is balanced: debits === credits.
    const entry = await tx.journalEntry.findUnique({ where: { id: synced.journalEntryId } })
    expect(isBalanced(entry.lines.map((l: any) => ({ accountId: l.accountId, amount: l.amount.toString(), isDebit: l.isDebit })))).toBe(true)
    const debitTotal = entry.lines.filter((l: any) => l.isDebit).reduce((s: number, l: any) => s + Number(l.amount), 0)
    const creditTotal = entry.lines.filter((l: any) => !l.isDebit).reduce((s: number, l: any) => s + Number(l.amount), 0)
    expect(debitTotal).toBeCloseTo(creditTotal, 6)
  })

  it('is idempotent: syncing an already-completed run does not re-post the ledger or duplicate the paystub', async () => {
    const tx = makeFullTx()
    tx.__store['pr1'] = {
      id: 'pr1', organizationId: ORG, status: 'draft', offCycle: false,
      payPeriodStart, payPeriodEnd,
      lines: [{ id: 'line1', employeeId: 'emp1', grossPay: '1000', reimbursements: '0' }],
    }
    mockProvider.calculatePayroll.mockResolvedValue({
      providerPayrollId: 'run1', status: 'calculated',
      totalGross: '1000.00', totalEmployeeTax: '0.00', totalEmployerTax: '0.00',
      totalPretaxDeductions: '0.00', totalPosttaxDeductions: '0.00', totalReimbursements: '0.00',
      totalNetPay: '1000.00', debitDate: '2026-01-15', employeePaymentDate: '2026-01-15',
      lines: [{
        employeeExternalId: 'emp1', grossPay: '1000.00', pretaxDeductions: '0.00', employeeTax: '0.00',
        posttaxDeductions: '0.00', garnishments: '0.00', reimbursements: '0.00', netPay: '1000.00',
        employerTax: '0.00', employerBenefitsCost: '0.00',
      }],
      warnings: [],
    })
    await calculatePayRun(tx as any, 'pr1', 'preparer1')
    await submitPayRunForApproval(tx as any, 'pr1', 'preparer1')
    mockProvider.approvePayroll.mockResolvedValue({ providerPayrollId: 'run1', status: 'submitted' })
    await submitApprovedPayRun(tx as any, 'pr1', 'approver1')

    mockProvider.retrievePayroll.mockResolvedValue({ providerPayrollId: 'run1', status: 'paid' })
    const first = await syncPayRunStatus(tx as any, 'pr1', 'actor1')
    expect(first.status).toBe('completed')
    expect(tx.payStub.create).toHaveBeenCalledTimes(1)
    expect(tx.journalEntry.create).toHaveBeenCalledTimes(1)

    const second = await syncPayRunStatus(tx as any, 'pr1', 'actor1')
    expect(second.status).toBe('completed')
    expect(second.journalEntryId).toBe(first.journalEntryId)
    // No additional paystub or journal entry was created on the second sync.
    expect(tx.payStub.create).toHaveBeenCalledTimes(1)
    expect(tx.journalEntry.create).toHaveBeenCalledTimes(1)
  })

  it('reverses a completed pay run with a balanced mirror-image journal entry, and blocks a second reversal', async () => {
    const tx = makeFullTx()
    tx.__store['pr1'] = {
      id: 'pr1', organizationId: ORG, status: 'completed',
      payPeriodStart, payPeriodEnd, payScheduleId: null,
      totalGross: '1000', totalEmployeeTax: '150', totalEmployerTax: '80',
      totalPretaxDeductions: '0', totalPosttaxDeductions: '0', totalGarnishments: '0',
      totalReimbursements: '0', totalEmployerBenefitsCost: '0', totalNetPay: '850',
      journalEntryId: 'je-original',
      lines: [],
    }
    // seed the original journal entry the reversal will mirror
    const originalLines = [
      { accountId: EXPENSE_ACCOUNT, amount: '1000.000000', isDebit: true },
      { accountId: TAX_EXPENSE_ACCOUNT, amount: '80.000000', isDebit: true },
      { accountId: LIABILITY_ACCOUNT, amount: '850.000000', isDebit: false },
      { accountId: TAX_LIABILITY_ACCOUNT, amount: '230.000000', isDebit: false },
    ]
    tx.__journalEntries['je-original'] = { id: 'je-original', lines: originalLines }

    const reversal = await reversePayRun(tx as any, 'pr1', 'actor1')
    expect(reversal.reversalOfPayRunId).toBe('pr1')
    expect(reversal.totalGross).toBe('-1000')
    expect(tx.__store['pr1'].status).toBe('reversed')

    const reversalEntry = await tx.journalEntry.findUnique({ where: { idempotencyKey: 'pay-run:pr1:reversal' } })
    expect(reversalEntry).toBeTruthy()
    expect(isBalanced(reversalEntry.lines.map((l: any) => ({ accountId: l.accountId, amount: l.amount.toString(), isDebit: l.isDebit })))).toBe(true)
    // Every line's debit/credit flag was flipped relative to the original.
    expect(reversalEntry.lines.map((l: any) => l.isDebit)).toEqual(originalLines.map((l) => !l.isDebit))

    // Second reversal attempt is blocked (status is no longer 'completed').
    await expect(reversePayRun(tx as any, 'pr1', 'actor1')).rejects.toThrow(/completed pay runs can be reversed/)
  })
})
