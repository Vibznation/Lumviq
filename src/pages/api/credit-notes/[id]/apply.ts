import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { applyCreditNoteToInvoice } from '../../../../lib/invoicing'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const { invoiceId, amount } = req.body || {}
  if (!invoiceId || !amount) return res.status(400).json({ error: 'invoiceId and amount are required' })

  const creditNote = await prisma.creditNote.findUnique({ where: { id } })
  if (!creditNote) return res.status(404).json({ error: 'Credit note not found' })
  if (!(await userHasMembership(user.id, creditNote.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice || invoice.organizationId !== creditNote.organizationId || invoice.customerId !== creditNote.customerId) {
    return res.status(400).json({ error: 'Invoice does not belong to this customer/organization' })
  }

  try {
    const updated = await prisma.$transaction((tx) => applyCreditNoteToInvoice(tx, creditNote, invoice, amount, user.id))
    return res.status(200).json(updated)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
