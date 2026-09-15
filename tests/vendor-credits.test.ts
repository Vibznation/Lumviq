import { describe, it, expect, vi } from 'vitest'
import { findPayableAccount, postVendorCreditToLedger, applyVendorCreditToBill } from '../src/lib/vendor-credits'

const credit = {
  id: 'vc1',
  organizationId: 'org',
  vendorId: 'vendor1',
  creditNumber: 'VC-0001',
  amount: '50.000000',
  remainingAmount: '50.000000',
  expenseAccountId: 'exp1',
  journalEntryId: null,
}

describe('vendor-credits.ts findPayableAccount', () => {
  it('throws when no Accounts Payable account is configured', async () => {
    const tx = { account: { findFirst: vi.fn(async () => null) } }
    await expect(findPayableAccount(tx as any, 'org')).rejects.toThrow()
  })

  it('returns the payable account for the organization', async () => {
    const payable = { id: 'ap1', subtype: 'payable' }
    const tx = { account: { findFirst: vi.fn(async () => payable) } }
    const account = await findPayableAccount(tx as any, 'org')
    expect(account).toBe(payable)
  })
})

describe('vendor-credits.ts postVendorCreditToLedger', () => {
  function makeTx({ payableAccount }: { payableAccount?: any } = {}) {
    return {
      account: { findFirst: vi.fn(async () => payableAccount ?? null) },
      journalEntry: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => ({ id: 'je-vc1', lines: data.lines.create })),
      },
      vendorCredit: { update: vi.fn(async ({ data }: any) => data) },
      auditEvent: { create: vi.fn(async () => ({})) },
    }
  }

  it('posts Debit Accounts Payable / Credit the expense account', async () => {
    const tx = makeTx({ payableAccount: { id: 'ap1' } })
    const entry = await postVendorCreditToLedger(tx as any, credit, 'actor1')
    expect(entry.lines).toEqual([
      { accountId: 'ap1', amount: '50.000000', isDebit: true, description: 'Vendor credit VC-0001' },
      { accountId: 'exp1', amount: '50.000000', isDebit: false, description: 'Vendor credit VC-0001' },
    ])
    expect(tx.vendorCredit.update).toHaveBeenCalledWith({ where: { id: 'vc1' }, data: { journalEntryId: 'je-vc1' } })
  })

  it('is idempotent when journalEntryId is already set', async () => {
    const existing = { id: 'je-existing', lines: [] }
    const tx = { journalEntry: { findUnique: vi.fn(async () => existing), create: vi.fn() } }
    const entry = await postVendorCreditToLedger(tx as any, { ...credit, journalEntryId: 'je-existing' }, 'actor1')
    expect(entry).toBe(existing)
    expect(tx.journalEntry.create).not.toHaveBeenCalled()
  })

  it('throws when no Accounts Payable account is configured', async () => {
    const tx = makeTx({})
    await expect(postVendorCreditToLedger(tx as any, credit, 'actor1')).rejects.toThrow()
  })
})

describe('vendor-credits.ts applyVendorCreditToBill', () => {
  function makeApplyTx() {
    return {
      vendorCredit: { update: vi.fn(async ({ data }: any) => data) },
      bill: { update: vi.fn(async ({ data }: any) => ({ id: 'bill1', ...data })) },
      auditEvent: { create: vi.fn(async () => ({})) },
    }
  }
  const billForApply = { id: 'bill1', total: '100.000000', amountPaid: '0.000000' }

  it('reduces remaining credit and increases bill amountPaid', async () => {
    const tx = makeApplyTx()
    const updated = await applyVendorCreditToBill(tx as any, credit, billForApply, '30', 'actor1')
    expect(tx.vendorCredit.update).toHaveBeenCalledWith({ where: { id: 'vc1' }, data: { remainingAmount: '20.000000' } })
    expect(updated.amountPaid).toBe('30.000000')
  })

  it('rejects an amount exceeding the remaining credit balance', async () => {
    const tx = makeApplyTx()
    await expect(applyVendorCreditToBill(tx as any, credit, billForApply, '999', 'actor1')).rejects.toThrow()
  })

  it('rejects an amount exceeding the bill outstanding balance', async () => {
    const tx = makeApplyTx()
    const almostPaidBill = { id: 'bill1', total: '100.000000', amountPaid: '90.000000' }
    await expect(applyVendorCreditToBill(tx as any, credit, almostPaidBill, '50', 'actor1')).rejects.toThrow()
  })
})
