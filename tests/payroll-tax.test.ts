/**
 * Proof-of-completion: payroll tax center — syncing liabilities/filings
 * from the provider, recording a balanced reconciling payment against
 * the ledger, and syncing year-end tax documents.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { isBalanced } from '../src/lib/ledger'

const mockProvider = {
  name: 'sandbox',
  isConfigured: () => true,
  retrieveTaxLiabilities: vi.fn(),
  retrieveTaxFilings: vi.fn(),
  retrieveTaxDocuments: vi.fn(),
}

vi.mock('../src/lib/integrations/payroll-sandbox', () => ({
  getPayrollProvider: () => mockProvider,
}))

import { syncTaxLiabilities, syncTaxFilings, recordTaxPayment, syncTaxDocuments } from '../src/lib/payroll-tax'
import { PayrollProviderNotConnectedError } from '../src/lib/payroll-run'

const ORG = randomUUID()
const TAX_LIABILITY_ACCOUNT = randomUUID()
const BANK_ACCOUNT = randomUUID()

function makeTx() {
  const taxFilings: Record<string, any> = {}
  const taxDocuments: Record<string, any> = {}
  const journalEntries: Record<string, any> = {}
  const journalEntriesByIdempotencyKey: Record<string, any> = {}
  let nextId = 1
  const genId = () => `id-${nextId++}`

  const companyProfile = { organizationId: ORG, providerCompanyId: 'sandbox_co_1' }
  const accounts: Record<string, any> = { [TAX_LIABILITY_ACCOUNT]: { id: TAX_LIABILITY_ACCOUNT, organizationId: ORG, subtype: 'payroll_tax_liability' } }
  const accountsById: Record<string, any> = { [TAX_LIABILITY_ACCOUNT]: accounts[TAX_LIABILITY_ACCOUNT], [BANK_ACCOUNT]: { id: BANK_ACCOUNT, organizationId: ORG, subtype: 'bank' } }

  return {
    payrollCompanyProfile: { findUnique: async () => companyProfile },
    taxFiling: {
      findFirst: vi.fn(async ({ where }: any) => {
        return Object.values(taxFilings).find(
          (f: any) => f.organizationId === where.organizationId && f.jurisdiction === where.jurisdiction && f.formType === where.formType && (where.status ? f.status === where.status : true)
        ) ?? null
      }),
      findUnique: vi.fn(async ({ where }: any) => taxFilings[where.id] ?? null),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: genId(), ...data }
        taxFilings[row.id] = row
        return row
      }),
      update: vi.fn(async ({ where, data }: any) => {
        taxFilings[where.id] = { ...taxFilings[where.id], ...data }
        return taxFilings[where.id]
      }),
    },
    account: {
      findFirst: vi.fn(async ({ where }: any) => Object.values(accountsById).find((a: any) => a.organizationId === where.organizationId && a.subtype === where.subtype) ?? null),
      findUnique: vi.fn(async ({ where }: any) => accountsById[where.id] ?? null),
    },
    accountingPeriod: { findFirst: vi.fn(async () => null) },
    auditEvent: { create: vi.fn(async () => ({})) },
    journalEntry: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.id) return journalEntries[where.id] ?? null
        if (where.idempotencyKey) return journalEntriesByIdempotencyKey[where.idempotencyKey] ?? null
        return null
      }),
      create: vi.fn(async ({ data }: any) => {
        const entry = { id: `je-${randomUUID()}`, ...data, lines: (data.lines?.create ?? []).map((l: any, i: number) => ({ id: `jl-${i}`, ...l })) }
        journalEntries[entry.id] = entry
        if (data.idempotencyKey) journalEntriesByIdempotencyKey[data.idempotencyKey] = entry
        return entry
      }),
    },
    employee: { findMany: vi.fn(async () => []) },
    contractor: { findMany: vi.fn(async () => []) },
    payrollTaxDocument: {
      findFirst: vi.fn(async ({ where }: any) =>
        Object.values(taxDocuments).find((d: any) => d.organizationId === where.organizationId && d.documentType === where.documentType && d.taxYear === where.taxYear && d.employeeId === where.employeeId && d.contractorId === where.contractorId) ?? null
      ),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: genId(), ...data }
        taxDocuments[row.id] = row
        return row
      }),
      update: vi.fn(async ({ where, data }: any) => {
        taxDocuments[where.id] = { ...taxDocuments[where.id], ...data }
        return taxDocuments[where.id]
      }),
    },
    __taxFilings: taxFilings,
    __journalEntries: journalEntries,
  }
}

describe('payroll tax center (proof of completion)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects tax sync when no provider is connected', async () => {
    mockProvider.isConfigured = () => false
    const tx = makeTx()
    await expect(syncTaxLiabilities(tx as any, ORG)).rejects.toThrow(PayrollProviderNotConnectedError)
    mockProvider.isConfigured = () => true
  })

  it('syncs outstanding tax liabilities into TaxFiling rows', async () => {
    const tx = makeTx()
    mockProvider.retrieveTaxLiabilities.mockResolvedValue([
      { jurisdiction: 'federal', formType: '941', amount: '303.00', dueDate: new Date('2026-02-15').toISOString() },
    ])
    const results = await syncTaxLiabilities(tx as any, ORG)
    expect(results).toHaveLength(1)
    expect(results[0].amount).toBe('303.00')
    expect(results[0].status).toBe('pending')

    // Syncing again updates the existing pending filing rather than duplicating it.
    mockProvider.retrieveTaxLiabilities.mockResolvedValue([
      { jurisdiction: 'federal', formType: '941', amount: '320.00', dueDate: new Date('2026-02-15').toISOString() },
    ])
    const second = await syncTaxLiabilities(tx as any, ORG)
    expect(second).toHaveLength(1)
    expect(second[0].id).toBe(results[0].id)
    expect(second[0].amount).toBe('320.00')
    expect(Object.keys(tx.__taxFilings)).toHaveLength(1)
  })

  it('syncs filing statuses from the provider', async () => {
    const tx = makeTx()
    mockProvider.retrieveTaxFilings.mockResolvedValue([
      {
        jurisdiction: 'federal', formType: '941',
        filingPeriodStart: new Date('2026-01-01').toISOString(),
        filingPeriodEnd: new Date('2026-03-31').toISOString(),
        status: 'filed', confirmationId: 'conf-123',
      },
    ])
    const results = await syncTaxFilings(tx as any, ORG)
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('filed')
    expect(results[0].providerConfirmation).toBe('conf-123')
    expect(results[0].filedAt).toBeInstanceOf(Date)
  })

  it('records a tax payment with a balanced journal entry (debit liability, credit bank), and is idempotent', async () => {
    const tx = makeTx()
    tx.__taxFilings['filing1'] = { id: 'filing1', organizationId: ORG, jurisdiction: 'federal', formType: '941', amount: '303.00', status: 'pending' }

    const updated = await recordTaxPayment(tx as any, ORG, 'filing1', BANK_ACCOUNT, 'actor1')
    expect(updated.status).toBe('paid')
    expect(tx.journalEntry.create).toHaveBeenCalledTimes(1)

    const entry = Object.values(tx.__journalEntries)[0] as any
    const lines = entry.lines.map((l: any) => ({ accountId: l.accountId, amount: l.amount.toString(), isDebit: l.isDebit }))
    expect(isBalanced(lines)).toBe(true)
    const debit = lines.find((l: any) => l.isDebit)
    const credit = lines.find((l: any) => !l.isDebit)
    expect(debit.accountId).toBe(TAX_LIABILITY_ACCOUNT)
    expect(credit.accountId).toBe(BANK_ACCOUNT)
    expect(Number(debit.amount)).toBeCloseTo(Number(credit.amount), 6)

    // Idempotent: paying an already-paid filing is a no-op, no second journal entry.
    const second = await recordTaxPayment(tx as any, ORG, 'filing1', BANK_ACCOUNT, 'actor1')
    expect(second.status).toBe('paid')
    expect(tx.journalEntry.create).toHaveBeenCalledTimes(1)
  })

  it('syncs year-end tax documents (W-2/1099) from the provider', async () => {
    const tx = makeTx()
    tx.employee.findMany = vi.fn(async () => [{ id: 'emp1', providerEmployeeId: 'sandbox_emp_1' }]) as any
    mockProvider.retrieveTaxDocuments.mockResolvedValue([
      { ownerExternalId: 'sandbox_emp_1', documentType: 'w2', taxYear: 2026, status: 'pending' },
    ])
    const results = await syncTaxDocuments(tx as any, ORG, 2026)
    expect(results).toHaveLength(1)
    expect(results[0].employeeId).toBe('emp1')
    expect(results[0].ownerType).toBe('employee')
    expect(results[0].documentType).toBe('w2')
  })
})
