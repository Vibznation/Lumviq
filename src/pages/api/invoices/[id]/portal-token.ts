import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { createInvoicePortalToken } from '../../../../lib/portal-tokens'

/** Creates a guest-access portal link for this invoice. Body: { expiresInDays? } */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  if (!(await userHasMembership(user.id, invoice.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const { expiresInDays } = req.body || {}
  const record = await createInvoicePortalToken(prisma, id, expiresInDays || 30)
  const appUrl = process.env.APP_URL || ''
  return res.status(201).json({ ...record, portalUrl: `${appUrl}/portal/invoices/${record.token}` })
}
