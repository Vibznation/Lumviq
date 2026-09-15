import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const reimbursement = await prisma.reimbursement.findUnique({
    where: { id },
    include: { lines: { orderBy: { date: 'asc' } } },
  })
  if (!reimbursement) return res.status(404).json({ error: 'Reimbursement not found' })
  if (!(await userHasMembership(user.id, reimbursement.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  return res.status(200).json(reimbursement)
}
