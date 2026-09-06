import { describe, it, expect, vi } from 'vitest'
import { recordPurchaseStockMovement, recordSaleStockMovement, recordAdjustmentStockMovement } from '../src/lib/inventory'

function makeTx(product: any) {
  return {
    product: {
      findUnique: vi.fn(async () => product),
      update: vi.fn(async ({ data }: any) => ({ ...product, ...data })),
    },
    stockMovement: {
      create: vi.fn(async ({ data }: any) => data),
    },
  }
}

describe('inventory.ts average-cost stock movements', () => {
  it('recordPurchaseStockMovement computes the weighted average cost', async () => {
    const product = { id: 'p1', organizationId: 'org', quantityOnHand: '10', costPrice: '5' }
    const tx = makeTx(product)
    const movement = await recordPurchaseStockMovement(tx as any, 'org', 'p1', '10', '7', 'bill', 'bill1')
    // old value 10*5=50, added value 10*7=70, total 120 / 20 qty = 6
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { quantityOnHand: '20.000000', costPrice: '6.000000' },
    })
    expect(movement).toMatchObject({ type: 'purchase', quantity: '10.000000', unitCost: '7.000000' })
  })

  it('recordPurchaseStockMovement throws for a product belonging to another organization', async () => {
    const tx = makeTx({ id: 'p1', organizationId: 'other-org', quantityOnHand: '0', costPrice: '0' })
    await expect(recordPurchaseStockMovement(tx as any, 'org', 'p1', '1', '1', 'bill', 'b1')).rejects.toThrow()
  })

  it('recordPurchaseStockMovement throws when the product does not exist', async () => {
    const tx = makeTx(null)
    await expect(recordPurchaseStockMovement(tx as any, 'org', 'missing', '1', '1', 'bill', 'b1')).rejects.toThrow()
  })

  it('recordSaleStockMovement decreases quantity and returns the cost at current average', async () => {
    const product = { id: 'p1', organizationId: 'org', quantityOnHand: '20', costPrice: '6' }
    const tx = makeTx(product)
    const result = await recordSaleStockMovement(tx as any, 'org', 'p1', '5', 'invoice', 'inv1')
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { quantityOnHand: '15.000000' } })
    expect(result).toEqual({ unitCost: '6.000000', totalCost: '30.000000' })
  })

  it('recordSaleStockMovement allows quantity to go negative (surfaced, not blocked)', async () => {
    const product = { id: 'p1', organizationId: 'org', quantityOnHand: '2', costPrice: '6' }
    const tx = makeTx(product)
    await recordSaleStockMovement(tx as any, 'org', 'p1', '5', 'invoice', 'inv1')
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { quantityOnHand: '-3.000000' } })
  })

  it('recordAdjustmentStockMovement applies a signed delta', async () => {
    const product = { id: 'p1', organizationId: 'org', quantityOnHand: '15', costPrice: '6' }
    const tx = makeTx(product)
    const movement = await recordAdjustmentStockMovement(tx as any, 'org', 'p1', '-2', 'shrinkage')
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { quantityOnHand: '13.000000' } })
    expect(movement).toMatchObject({ type: 'adjustment', quantity: '-2.000000', referenceId: 'shrinkage' })
  })
})
