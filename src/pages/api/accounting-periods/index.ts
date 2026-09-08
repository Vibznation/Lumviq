import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/** Lists an organization's accounting periods (via their fiscal years), most recent first. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const periods = await prisma.accountingPeriod.findMany({
    where: { fiscalYear: { organizationId } },
    include: { fiscalYear: { select: { startDate: true, endDate: true } } },
    orderBy: { startDate: 'desc' },
  })
  return res.status(200).json(periods)
}
