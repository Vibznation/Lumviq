/**
 * Inventory domain service. All quantity/cost changes to a Product must flow
 * through here so financial postings (COGS, inventory asset value) stay in
 * sync with stock levels. Uses average cost (the only valuation method
 * currently implemented; extensible to FIFO/lot tracking later).
 */
import { toMinorUnits, fromMinorUnits, multiplyMinor, addMinor } from './money'

/** Increases stock on hand from a purchase (bill) and recomputes the weighted average cost. */
export async function recordPurchaseStockMovement(
  tx: any,
  organizationId: string,
  productId: string,
  quantity: string | number,
  unitCost: string | number,
  referenceType: string,
  referenceId: string
) {
  const product = await tx.product.findUnique({ where: { id: productId } })
  if (!product || product.organizationId !== organizationId) throw new Error('Product not found in this organization')

  const oldQty = toMinorUnits(product.quantityOnHand.toString())
  const oldCost = toMinorUnits((product.costPrice ?? '0').toString())
  const addQty = toMinorUnits(quantity)
  const cost = toMinorUnits(unitCost)

  const oldValue = multiplyMinor(oldQty, oldCost)
  const addValue = multiplyMinor(addQty, cost)
  const newQty = addMinor(oldQty, addQty)
  const newCost = newQty > BigInt(0) ? (addMinor(oldValue, addValue) * BigInt(1_000_000)) / newQty : cost

  await tx.product.update({
    where: { id: productId },
    data: { quantityOnHand: fromMinorUnits(newQty), costPrice: fromMinorUnits(newCost) },
  })

  return tx.stockMovement.create({
    data: {
      organizationId,
      productId,
      type: 'purchase',
      quantity: fromMinorUnits(addQty),
      unitCost: fromMinorUnits(cost),
      referenceType,
      referenceId,
    },
  })
}

/** Decreases stock on hand from a sale (invoice) at the current average cost. Returns the cost used, for COGS posting. */
export async function recordSaleStockMovement(
  tx: any,
  organizationId: string,
  productId: string,
  quantity: string | number,
  referenceType: string,
  referenceId: string
) {
  const product = await tx.product.findUnique({ where: { id: productId } })
  if (!product || product.organizationId !== organizationId) throw new Error('Product not found in this organization')

  const oldQty = toMinorUnits(product.quantityOnHand.toString())
  const saleQty = toMinorUnits(quantity)
  const unitCost = toMinorUnits((product.costPrice ?? '0').toString())

  await tx.product.update({
    where: { id: productId },
    data: { quantityOnHand: fromMinorUnits(oldQty - saleQty) },
  })

  await tx.stockMovement.create({
    data: {
      organizationId,
      productId,
      type: 'sale',
      quantity: fromMinorUnits(-saleQty),
      unitCost: fromMinorUnits(unitCost),
      referenceType,
      referenceId,
    },
  })

  return { unitCost: fromMinorUnits(unitCost), totalCost: fromMinorUnits(multiplyMinor(saleQty, unitCost)) }
}

/** Manual stock adjustment (e.g. stocktake correction, shrinkage). Signed quantity: positive increases, negative decreases. */
export async function recordAdjustmentStockMovement(
  tx: any,
  organizationId: string,
  productId: string,
  signedQuantity: string | number,
  note: string
) {
  const product = await tx.product.findUnique({ where: { id: productId } })
  if (!product || product.organizationId !== organizationId) throw new Error('Product not found in this organization')

  const oldQty = toMinorUnits(product.quantityOnHand.toString())
  const delta = toMinorUnits(signedQuantity)
  const unitCost = toMinorUnits((product.costPrice ?? '0').toString())

  await tx.product.update({
    where: { id: productId },
    data: { quantityOnHand: fromMinorUnits(oldQty + delta) },
  })

  return tx.stockMovement.create({
    data: {
      organizationId,
      productId,
      type: 'adjustment',
      quantity: fromMinorUnits(delta),
      unitCost: fromMinorUnits(unitCost),
      referenceType: 'adjustment',
      referenceId: note,
    },
  })
}
