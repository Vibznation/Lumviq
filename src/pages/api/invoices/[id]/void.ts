import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { reverseInvoiceJournal } from '../../../../lib/invoicing'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  if (!(await userHasMembership(user.id, invoice.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (invoice.voidedAt) return res.status(400).json({ error: 'Invoice is already voided' })
  if (Number(invoice.amountPaid) > 0) {
    return res.status(400).json({ error: 'Cannot void an invoice that has recorded payments' })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await reverseInvoiceJournal(tx, invoice, user.id)
      return tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'voided', voidedAt: new Date() },
        include: { lines: true, customer: true, payments: true },
      })
    })
    return res.status(200).json(updated)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
