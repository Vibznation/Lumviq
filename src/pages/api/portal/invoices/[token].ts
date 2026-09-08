import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { resolveInvoicePortalToken } from '../../../../lib/portal-tokens'

/**
 * Public guest endpoint — no authentication. Returns a view-only invoice
 * summary for a valid, unexpired portal token. Online payment is not
 * available (no payment processor is configured — see
 * src/lib/integrations/payments.ts); this only supports viewing/download.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }
  const token = req.query.token as string
  const invoice = await resolveInvoicePortalToken(prisma, token)
  if (!invoice) return res.status(404).json({ error: 'This link is invalid or has expired' })

  return res.status(200).json({
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
    onlinePaymentAvailable: false,
  })
}
