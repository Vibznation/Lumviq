import { computeInvoiceTotals } from './invoicing'

/**
 * Domain logic for purchase orders. A PO never touches the ledger
 * directly — only converting it to a Bill (via convertPurchaseOrderToBill)
 * creates a real, postable record.
 */

/** Generates the next sequential PO number for an organization, e.g. PO-0007. */
export async function nextPoNumber(tx: any, organizationId: string): Promise<string> {
  const count = await tx.purchaseOrder.count({ where: { organizationId } })
  return `PO-${String(count + 1).padStart(4, '0')}`
}

export function computePoTotals(lines: Array<{ quantity: string | number; unitPrice: string | number }>) {
  return computeInvoiceTotals(lines, '0')
}

/**
 * Converts a received purchase order into a draft Bill carrying the same
 * lines. Idempotent: if the PO already has a convertedBillId, the existing
 * bill is returned unchanged.
 */
export async function convertPurchaseOrderToBill(tx: any, po: any, billNumber: string, actorId: string) {
  if (po.convertedBillId) {
    return tx.bill.findUnique({ where: { id: po.convertedBillId }, include: { lines: true } })
  }

  const bill = await tx.bill.create({
    data: {
      organizationId: po.organizationId,
      vendorId: po.vendorId,
      billNumber,
      vendorReference: po.poNumber,
      status: 'draft',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      currency: po.currency,
      subtotal: po.subtotal,
      taxTotal: '0',
      total: po.total,
      lines: {
        create: po.lines.map((l: any) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
          accountId: l.accountId,
          productId: l.productId,
        })),
      },
    },
    include: { lines: true },
  })

  await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'received', convertedBillId: bill.id } })

  await tx.auditEvent.create({
    data: {
      organizationId: po.organizationId,
      actorId,
      action: 'purchase_order.convert',
      resourceType: 'purchase_order',
      resourceId: po.id,
      newState: { billId: bill.id },
    },
  })

  return bill
}
