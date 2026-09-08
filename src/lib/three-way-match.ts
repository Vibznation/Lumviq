/**
 * Three-way matching: compares a PurchaseOrder's ordered quantities
 * against goods-receipt quantities (PurchaseOrderReceipt/
 * PurchaseOrderReceiptLine) and a Bill's billed quantities, flagging any
 * line where they disagree beyond a small tolerance. This is a
 * verification check surfaced to the user before approving a bill for
 * payment — it does not itself block bill creation/posting.
 */

const QUANTITY_TOLERANCE = 0.01

export async function recordReceipt(
  tx: any,
  params: { organizationId: string; purchaseOrderId: string; receivedDate: Date; notes?: string; lines: Array<{ purchaseOrderLineId: string; quantityReceived: number }> }
) {
  return tx.purchaseOrderReceipt.create({
    data: {
      organizationId: params.organizationId,
      purchaseOrderId: params.purchaseOrderId,
      receivedDate: params.receivedDate,
      notes: params.notes,
      lines: { create: params.lines.map((l) => ({ purchaseOrderLineId: l.purchaseOrderLineId, quantityReceived: l.quantityReceived.toString() })) },
    },
    include: { lines: true },
  })
}

export interface MatchLineResult {
  purchaseOrderLineId: string
  description: string
  orderedQuantity: number
  receivedQuantity: number
  billedQuantity: number
  matched: boolean
  discrepancy: string | null
}

/** Compares ordered vs. received vs. billed quantities for every line on a PO. */
export async function checkThreeWayMatch(tx: any, purchaseOrderId: string, billId?: string | null): Promise<{ fullyMatched: boolean; lines: MatchLineResult[] }> {
  const po = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { lines: true } })
  if (!po) throw new Error('Purchase order not found')

  const receipts = await tx.purchaseOrderReceipt.findMany({ where: { purchaseOrderId }, include: { lines: true } })
  const receivedByLine = new Map<string, number>()
  for (const receipt of receipts) {
    for (const rl of receipt.lines) {
      receivedByLine.set(rl.purchaseOrderLineId, (receivedByLine.get(rl.purchaseOrderLineId) || 0) + Number(rl.quantityReceived))
    }
  }

  const bill = billId ? await tx.bill.findUnique({ where: { id: billId }, include: { lines: true } }) : po.convertedBillId ? await tx.bill.findUnique({ where: { id: po.convertedBillId }, include: { lines: true } }) : null
  // Best-effort match of bill lines to PO lines by description, since Bill doesn't carry a purchaseOrderLineId FK.
  const billedByDescription = new Map<string, number>()
  if (bill) {
    for (const bl of bill.lines) {
      billedByDescription.set(bl.description, (billedByDescription.get(bl.description) || 0) + Number(bl.quantity))
    }
  }

  const lines: MatchLineResult[] = po.lines.map((pl: any) => {
    const orderedQuantity = Number(pl.quantity)
    const receivedQuantity = receivedByLine.get(pl.id) || 0
    const billedQuantity = billedByDescription.get(pl.description) || 0
    const discrepancies: string[] = []
    if (Math.abs(receivedQuantity - orderedQuantity) > QUANTITY_TOLERANCE) {
      discrepancies.push(`ordered ${orderedQuantity} but received ${receivedQuantity}`)
    }
    if (bill && Math.abs(billedQuantity - receivedQuantity) > QUANTITY_TOLERANCE) {
      discrepancies.push(`received ${receivedQuantity} but billed ${billedQuantity}`)
    }
    return {
      purchaseOrderLineId: pl.id,
      description: pl.description,
      orderedQuantity,
      receivedQuantity,
      billedQuantity,
      matched: discrepancies.length === 0,
      discrepancy: discrepancies.length > 0 ? discrepancies.join('; ') : null,
    }
  })

  return { fullyMatched: lines.every((l) => l.matched), lines }
}
