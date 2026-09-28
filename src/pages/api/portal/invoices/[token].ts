import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { resolveInvoicePortalToken } from '../../../../lib/portal-tokens'
import { getPaymentProcessor } from '../../../../lib/integrations/payments'

/**
 * Public guest endpoint — no authentication. Returns a view-only invoice
 * summary for a valid, unexpired portal token. Online payment availability
 * depends on whether a PaymentProcessor is configured.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }
  const token = req.query.token as string
  const invoice = await resolveInvoicePortalToken(prisma, token)
  if (!invoice) return res.status(404).json({ error: 'This link is invalid or has expired' })

  const processor = getPaymentProcessor()
  const onlinePaymentAvailable = Boolean(processor && processor.isConfigured() && invoice.status !== 'paid')

  // Fetch recent invoice history for the same customer under this organization if available
  let history: Array<{ id: string; invoiceNumber: string; issueDate: Date; dueDate: Date; total: string; amountPaid: string; status: string }> = []
  if (invoice.customerId) {
    const records = await prisma.invoice.findMany({
      where: {
        organizationId: invoice.organizationId,
        customerId: invoice.customerId,
        status: { notIn: ['void'] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        status: true,
      },
      orderBy: { issueDate: 'desc' },
      take: 10,
    })
    history = records.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      total: r.total.toString(),
      amountPaid: r.amountPaid.toString(),
      status: r.status,
    }))
  }

  return res.status(200).json({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    lines: invoice.lines,
    customer: invoice.customer ? { name: invoice.customer.name, email: invoice.customer.email } : null,
    organization: invoice.organization,
    onlinePaymentAvailable,
    history,
  })
}
