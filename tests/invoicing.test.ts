import { describe, it, expect, vi } from 'vitest'
import { postInvoiceToLedger, computeInvoiceTotals } from '../src/lib/invoicing'

function makeTx({ receivableAccount, product }: { receivableAccount?: any; product?: any } = {}) {
  return {
    account: {
      findFirst: vi.fn(async ({ where }: any) => (where.subtype === 'receivable' ? receivableAccount ?? null : null)),
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

const invoice = { id: 'inv1', organizationId: 'org', invoiceNumber: 'INV-0001', total: '108.250000', journalEntryId: null }

describe('invoicing.ts computeInvoiceTotals', () => {
  it('computes subtotal, tax and total from line items', () => {
    const totals = computeInvoiceTotals([{ quantity: '2', unitPrice: '50' }, { quantity: '1', unitPrice: '25' }], '8.25')
    expect(totals.lineAmounts).toEqual(['100.000000', '25.000000'])
    expect(totals.subtotal).toBe('125.000000')
    expect(totals.taxTotal).toBe('8.250000')
    expect(totals.total).toBe('133.250000')
  })

  it('defaults tax to zero when omitted', () => {
    const totals = computeInvoiceTotals([{ quantity: '3', unitPrice: '10' }])
    expect(totals.subtotal).toBe('30.000000')
    expect(totals.taxTotal).toBe('0.000000')
    expect(totals.total).toBe('30.000000')
  })
})

describe('invoicing.ts postInvoiceToLedger', () => {
  it('posts Debit AR / Credit revenue for lines with no product', async () => {
    const tx = makeTx({ receivableAccount: { id: 'ar1' } })
    const lines = [{ accountId: 'rev1', description: 'Consulting', amount: '108.250000' }]
    const entry = await postInvoiceToLedger(tx as any, invoice, lines, 'actor1')
    expect(entry.lines).toEqual([
      { accountId: 'ar1', amount: '108.250000', isDebit: true, description: 'Invoice INV-0001' },
      { accountId: 'rev1', amount: '108.250000', isDebit: false, description: 'Consulting' },
    ])
    expect(tx.stockMovement.create).not.toHaveBeenCalled()
  })

  it('skips COGS posting for a product with no inventory asset account', async () => {
    const tx = makeTx({
      receivableAccount: { id: 'ar1' },
      product: { id: 'prod1', organizationId: 'org', inventoryAssetAccountId: null },
    })
    const lines = [{ accountId: 'rev1', description: 'Service', amount: '100.000000', quantity: '1', productId: 'prod1' }]
    const entry = await postInvoiceToLedger(tx as any, invoice, lines, 'actor1')
    expect(entry.lines).toHaveLength(2)
    expect(tx.stockMovement.create).not.toHaveBeenCalled()
  })

  it('posts Debit COGS / Credit Inventory Asset for a tracked inventory product', async () => {
    const tx = makeTx({
      receivableAccount: { id: 'ar1' },
      product: {
        id: 'prod1', organizationId: 'org', quantityOnHand: '10', costPrice: '20',
        expenseAccountId: 'cogs1', inventoryAssetAccountId: 'inv-asset1',
      },
    })
    const lines = [{ accountId: 'rev1', description: 'Widget', amount: '100.000000', quantity: '2', productId: 'prod1' }]
    const entry = await postInvoiceToLedger(tx as any, invoice, lines, 'actor1')
    expect(entry.lines).toHaveLength(4)
    expect(entry.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 'cogs1', amount: '40.000000', isDebit: true }),
      expect.objectContaining({ accountId: 'inv-asset1', amount: '40.000000', isDebit: false }),
    ]))
    expect(tx.stockMovement.create).toHaveBeenCalled()
  })

  it('is idempotent when journalEntryId is already set', async () => {
    const existing = { id: 'je-existing', lines: [] }
    const tx = { journalEntry: { findUnique: vi.fn(async () => existing), create: vi.fn() } }
    const entry = await postInvoiceToLedger(tx as any, { ...invoice, journalEntryId: 'je-existing' }, [], 'actor1')
    expect(entry).toBe(existing)
    expect(tx.journalEntry.create).not.toHaveBeenCalled()
  })

  it('throws when no Accounts Receivable account is configured', async () => {
    const tx = makeTx({})
    await expect(
      postInvoiceToLedger(tx as any, invoice, [{ accountId: 'rev1', description: 'x', amount: '1' }], 'actor1')
    ).rejects.toThrow()
  })
})
