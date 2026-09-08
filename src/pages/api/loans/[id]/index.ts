import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const loan = await prisma.loan.findUnique({
    where: { id },
    include: { payments: { orderBy: { paymentDate: 'asc' } } },
  })
  if (!loan) return res.status(404).json({ error: 'Not found' })
  if (!(await userHasMembership(user.id, loan.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  return res.status(200).json(loan)
}
