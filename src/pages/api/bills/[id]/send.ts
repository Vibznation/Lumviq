import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { postBillToLedger } from '../../../../lib/purchasing'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const bill = await prisma.bill.findUnique({ where: { id }, include: { lines: true } })
  if (!bill) return res.status(404).json({ error: 'Bill not found' })
  if (!(await userHasMembership(user.id, bill.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (bill.status !== 'draft') return res.status(400).json({ error: 'Only draft bills can be sent' })
  if (bill.voidedAt) return res.status(400).json({ error: 'Bill has been voided' })

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const entry = await postBillToLedger(
        tx,
        bill,
        bill.lines.map((l) => ({
          accountId: l.accountId,
          description: l.description,
          amount: l.amount.toString(),
          quantity: l.quantity.toString(),
          unitPrice: l.unitPrice.toString(),
          productId: l.productId,
        })),
        user.id
      )
      return tx.bill.update({
        where: { id: bill.id },
        data: { status: 'open', journalEntryId: entry.id },
        include: { lines: true, vendor: true, payments: true },
      })
    })
    return res.status(200).json(updated)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
