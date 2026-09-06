import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { postPayRunToLedger } from '../../../../lib/payroll'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const payRun = await prisma.payRun.findUnique({ where: { id } })
  if (!payRun) return res.status(404).json({ error: 'Pay run not found' })
  if (!(await userHasMembership(user.id, payRun.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (payRun.status !== 'draft') return res.status(400).json({ error: 'Only draft pay runs can be posted' })

  try {
    const result = await prisma.$transaction(async (tx) => {
      const entry = await postPayRunToLedger(tx, payRun, user.id)
      const updated = await tx.payRun.update({
        where: { id },
        data: { status: 'posted', journalEntryId: entry.id, postedAt: new Date() },
        include: { lines: { include: { employee: true } } },
      })
      return updated
    })
    return res.status(200).json(result)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
