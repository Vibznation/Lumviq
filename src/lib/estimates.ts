import { computeInvoiceTotals } from './invoicing'

/**
 * Domain logic for sales estimates/quotes. An estimate never touches the
 * ledger directly — only converting it to an Invoice (via
 * convertEstimateToInvoice) creates a real, postable record.
 */

/** Generates the next sequential estimate number for an organization, e.g. EST-0007. */
export async function nextEstimateNumber(tx: any, organizationId: string): Promise<string> {
  const count = await tx.estimate.count({ where: { organizationId } })
  return `EST-${String(count + 1).padStart(4, '0')}`
}

export function computeEstimateTotals(lines: Array<{ quantity: string | number; unitPrice: string | number }>, taxTotal: string | number = '0') {
  return computeInvoiceTotals(lines, taxTotal)
}

/**
 * Converts an accepted estimate into a draft Invoice carrying the same
 * lines. Idempotent: if the estimate already has a convertedInvoiceId, the
 * existing invoice is returned unchanged.
 */
export async function convertEstimateToInvoice(tx: any, estimate: any, actorId: string) {
  if (estimate.convertedInvoiceId) {
    return tx.invoice.findUnique({ where: { id: estimate.convertedInvoiceId }, include: { lines: true } })
  }

  const { nextInvoiceNumber } = await import('./invoicing')
  const invoiceNumber = await nextInvoiceNumber(tx, estimate.organizationId)

  const invoice = await tx.invoice.create({
    data: {
      organizationId: estimate.organizationId,
      customerId: estimate.customerId,
      invoiceNumber,
      status: 'draft',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      currency: estimate.currency,
      subtotal: estimate.subtotal,
      taxRateId: estimate.taxRateId,
      taxTotal: estimate.taxTotal,
      total: estimate.total,
      lines: {
        create: estimate.lines.map((l: any) => ({
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

  await tx.estimate.update({ where: { id: estimate.id }, data: { status: 'accepted', convertedInvoiceId: invoice.id } })

  await tx.auditEvent.create({
    data: {
      organizationId: estimate.organizationId,
      actorId,
      action: 'estimate.convert',
      resourceType: 'estimate',
      resourceId: estimate.id,
      newState: { invoiceId: invoice.id },
    },
  })

  return invoice
}
