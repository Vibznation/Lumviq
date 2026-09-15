import { describe, it, expect, vi } from 'vitest'
import { recordReceipt, checkThreeWayMatch } from '../src/lib/three-way-match'

describe('three-way-match.ts recordReceipt', () => {
  it('creates a PurchaseOrderReceipt with its lines', async () => {
    const tx = {
      purchaseOrderReceipt: {
        create: vi.fn(async ({ data }: any) => ({ id: 'receipt1', ...data })),
      },
    }
    const receipt = await recordReceipt(tx as any, {
      organizationId: 'org',
      purchaseOrderId: 'po1',
      receivedDate: new Date('2024-01-01'),
      notes: 'Partial delivery',
      lines: [{ purchaseOrderLineId: 'pol1', quantityReceived: 5 }],
    })
    expect(tx.purchaseOrderReceipt.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org',
        purchaseOrderId: 'po1',
        receivedDate: new Date('2024-01-01'),
        notes: 'Partial delivery',
        lines: { create: [{ purchaseOrderLineId: 'pol1', quantityReceived: '5' }] },
      },
      include: { lines: true },
    })
    expect(receipt.id).toBe('receipt1')
  })
})

describe('three-way-match.ts checkThreeWayMatch', () => {
  const po = {
    id: 'po1',
    convertedBillId: null,
    lines: [{ id: 'pol1', description: 'Widgets', quantity: '10' }],
  }

  function makeTx({ receipts = [] as any[], bill = null as any } = {}) {
    return {
      purchaseOrder: { findUnique: vi.fn(async () => po) },
      purchaseOrderReceipt: { findMany: vi.fn(async () => receipts) },
      bill: { findUnique: vi.fn(async () => bill) },
    }
  }

  it('flags a discrepancy when received quantity does not match ordered quantity', async () => {
    const tx = makeTx({ receipts: [{ lines: [{ purchaseOrderLineId: 'pol1', quantityReceived: '7' }] }] })
    const result = await checkThreeWayMatch(tx as any, 'po1')
    expect(result.fullyMatched).toBe(false)
    expect(result.lines[0].receivedQuantity).toBe(7)
    expect(result.lines[0].discrepancy).toMatch(/ordered 10 but received 7/)
  })

  it('is fully matched when received equals ordered and no bill is given', async () => {
    const tx = makeTx({ receipts: [{ lines: [{ purchaseOrderLineId: 'pol1', quantityReceived: '10' }] }] })
    const result = await checkThreeWayMatch(tx as any, 'po1')
    expect(result.fullyMatched).toBe(true)
    expect(result.lines[0].discrepancy).toBeNull()
  })

  it('flags a discrepancy when billed quantity does not match received quantity', async () => {
    const tx = makeTx({
      receipts: [{ lines: [{ purchaseOrderLineId: 'pol1', quantityReceived: '10' }] }],
      bill: { lines: [{ description: 'Widgets', quantity: '8' }] },
    })
    const result = await checkThreeWayMatch(tx as any, 'po1', 'bill1')
    expect(result.fullyMatched).toBe(false)
    expect(result.lines[0].billedQuantity).toBe(8)
    expect(result.lines[0].discrepancy).toMatch(/received 10 but billed 8/)
  })
})
