import { describe, it, expect, vi } from 'vitest'
import { postBillToLedger, computeBillTotals } from '../src/lib/purchasing'

function makeTx({ payableAccount, product }: { payableAccount?: any; product?: any } = {}) {
  return {
    account: {
      findFirst: vi.fn(async ({ where }: any) => (where.subtype === 'payable' ? payableAccount ?? null : null)),
    },
    product: {
      findUnique: vi.fn(async () => product ?? null),
      update: vi.fn(async ({ data }: any) => ({ ...product, ...data })),
    },
    stockMovement: {
      create: vi.fn(async ({ data }: any) => data),
    },
    journalEntry: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({ id: 'je1', lines: data.lines.create })),
    },
    auditEvent: { create: vi.fn(async () => ({})) },
  }
}

const bill = { id: 'bill1', organizationId: 'org', billNumber: 'BILL-0001', total: '100.000000', journalEntryId: null }

describe('purchasing.ts computeBillTotals', () => {
  it('computes subtotal, tax and total from line items', () => {
    const totals = computeBillTotals([{ quantity: '4', unitPrice: '12.5' }], '5')
    expect(totals.subtotal).toBe('50.000000')
    expect(totals.taxTotal).toBe('5.000000')
    expect(totals.total).toBe('55.000000')
  })
})

describe('purchasing.ts postBillToLedger', () => {
  it('posts Debit expense / Credit Accounts Payable for lines with no product', async () => {
    const tx = makeTx({ payableAccount: { id: 'ap1' } })
    const lines = [{ accountId: 'exp1', description: 'Office supplies', amount: '100.000000' }]
    const entry = await postBillToLedger(tx as any, bill, lines, 'actor1')
    expect(entry.lines).toEqual([
      { accountId: 'exp1', amount: '100.000000', isDebit: true, description: 'Office supplies' },
      { accountId: 'ap1', amount: '100.000000', isDebit: false, description: 'Bill BILL-0001' },
    ])
    expect(tx.stockMovement.create).not.toHaveBeenCalled()
  })

  it('records a purchase stock movement and updates average cost for a line tied to a product', async () => {
    const tx = makeTx({
      payableAccount: { id: 'ap1' },
      product: { id: 'prod1', organizationId: 'org', quantityOnHand: '5', costPrice: '10' },
    })
    const lines = [{ accountId: 'inv-asset1', description: 'Widgets', amount: '100.000000', quantity: '10', unitPrice: '10', productId: 'prod1' }]
    await postBillToLedger(tx as any, bill, lines, 'actor1')
    expect(tx.stockMovement.create).toHaveBeenCalled()
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod1' },
      data: { quantityOnHand: '15.000000', costPrice: '10.000000' },
    })
  })

  it('is idempotent when journalEntryId is already set', async () => {
    const existing = { id: 'je-existing', lines: [] }
    const tx = { journalEntry: { findUnique: vi.fn(async () => existing), create: vi.fn() } }
    const entry = await postBillToLedger(tx as any, { ...bill, journalEntryId: 'je-existing' }, [], 'actor1')
    expect(entry).toBe(existing)
    expect(tx.journalEntry.create).not.toHaveBeenCalled()
  })

  it('throws when no Accounts Payable account is configured', async () => {
    const tx = makeTx({})
    await expect(
      postBillToLedger(tx as any, bill, [{ accountId: 'exp1', description: 'x', amount: '1' }], 'actor1')
    ).rejects.toThrow()
  })
})
