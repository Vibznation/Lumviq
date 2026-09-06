import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { reverseBillJournal } from '../../../../lib/purchasing'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const bill = await prisma.bill.findUnique({ where: { id } })
  if (!bill) return res.status(404).json({ error: 'Bill not found' })
  if (!(await userHasMembership(user.id, bill.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (bill.voidedAt) return res.status(400).json({ error: 'Bill is already voided' })
  if (Number(bill.amountPaid) > 0) {
    return res.status(400).json({ error: 'Cannot void a bill that has recorded payments' })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await reverseBillJournal(tx, bill, user.id)
      return tx.bill.update({
        where: { id: bill.id },
        data: { status: 'voided', voidedAt: new Date() },
        include: { lines: true, vendor: true, payments: true },
      })
    })
    return res.status(200).json(updated)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
