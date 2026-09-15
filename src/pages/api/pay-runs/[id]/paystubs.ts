import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const payRun = await prisma.payRun.findUnique({ where: { id } })
  if (!payRun) return res.status(404).json({ error: 'Pay run not found' })
  if (!(await userHasMembership(user.id, payRun.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const payStubs = await prisma.payStub.findMany({
    where: { payRunId: id },
    include: { payRunLine: { include: { employee: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return res.status(200).json(payStubs)
}
