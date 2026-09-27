import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const job = await prisma.backgroundJob.findUnique({ where: { id } })
  if (!job) return res.status(404).json({ error: 'Job not found' })

  if (job.organizationId && !(await userHasMembership(user.id, job.organizationId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const updated = await prisma.backgroundJob.update({
    where: { id },
    data: {
      status: 'pending',
      attempts: 0,
      runAt: new Date(),
      lastError: null,
    },
  })

  return res.status(200).json(updated)
}
