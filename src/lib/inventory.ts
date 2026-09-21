/**
 * Inventory domain service. All quantity/cost changes to a Product must flow
 * through here so financial postings (COGS, inventory asset value) stay in
 * sync with stock levels. Supports weighted average cost (default), FIFO
 * (first-in-first-out), and LIFO (last-in-first-out) valuation methods.
 */
import { toMinorUnits, fromMinorUnits, multiplyMinor, addMinor } from './money'

export type ValuationMethod = 'average' | 'fifo' | 'lifo'

export interface InventoryLayer {
  quantity: number
  unitCost: number
}

/**
 * Computes cost of goods sold (COGS) using FIFO (First-In-First-Out).
 * Consumes the earliest purchase layers first.
 */
export function calculateFifoCost(layers: InventoryLayer[], quantityToSell: number): { totalCost: number; averageUnitCost: number } {
  let remaining = quantityToSell
  let totalCost = 0

  for (const layer of layers) {
    if (remaining <= 0) break
    const take = Math.min(layer.quantity, remaining)
    totalCost += take * layer.unitCost
    remaining -= take
  }

  // If selling more than available in layers, cost remaining at the latest known cost or 0
  if (remaining > 0 && layers.length > 0) {
    const latestCost = layers[layers.length - 1].unitCost
    totalCost += remaining * latestCost
  }

  const averageUnitCost = quantityToSell > 0 ? totalCost / quantityToSell : 0
  return { totalCost, averageUnitCost }
}

/**
 * Computes cost of goods sold (COGS) using LIFO (Last-In-First-Out).
 * Consumes the most recent purchase layers first.
 */
export function calculateLifoCost(layers: InventoryLayer[], quantityToSell: number): { totalCost: number; averageUnitCost: number } {
  let remaining = quantityToSell
  let totalCost = 0

  // Reverse iterate through layers for LIFO
  for (let i = layers.length - 1; i >= 0; i--) {
    if (remaining <= 0) break
    const layer = layers[i]
    const take = Math.min(layer.quantity, remaining)
    totalCost += take * layer.unitCost
    remaining -= take
  }

  if (remaining > 0 && layers.length > 0) {
    const earliestCost = layers[0].unitCost
    totalCost += remaining * earliestCost
  }

  const averageUnitCost = quantityToSell > 0 ? totalCost / quantityToSell : 0
  return { totalCost, averageUnitCost }
}

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

/** Decreases stock on hand from a sale (invoice). Returns the cost used, for COGS posting. */
export async function recordSaleStockMovement(
  tx: any,
  organizationId: string,
  productId: string,
  quantity: string | number,
  referenceType: string,
  referenceId: string,
  valuationMethod: ValuationMethod = 'average'
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
