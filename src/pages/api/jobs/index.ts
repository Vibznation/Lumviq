import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })

  if (!(await userHasMembership(user.id, organizationId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const status = req.query.status as string | undefined
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100)

  const whereClause: any = {
    OR: [
      { organizationId },
      { organizationId: null },
    ],
  }
  if (status) {
    whereClause.status = status
  }

  const jobs = await prisma.backgroundJob.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const stats = {
    pending: await prisma.backgroundJob.count({ where: { organizationId, status: 'pending' } }),
    processing: await prisma.backgroundJob.count({ where: { organizationId, status: 'processing' } }),
    succeeded: await prisma.backgroundJob.count({ where: { organizationId, status: 'succeeded' } }),
    failed: await prisma.backgroundJob.count({ where: { organizationId, status: 'failed' } }),
  }

  return res.status(200).json({
    jobs,
    stats,
  })
}
