import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { fulfillPledge } from '../../../../lib/nonprofit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const { amount } = req.body || {}
  if (!amount) return res.status(400).json({ error: 'amount is required' })

  const pledge = await prisma.pledge.findUnique({ where: { id } })
  if (!pledge) return res.status(404).json({ error: 'Pledge not found' })
  if (!(await userHasMembership(user.id, pledge.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  try {
    const updated = await prisma.$transaction((tx) => fulfillPledge(tx, pledge, amount))
    return res.status(200).json(updated)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
