import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { createChecklistForPeriod } from '../../../lib/close-checklist'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    const accountingPeriodId = req.query.accountingPeriodId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const items = await prisma.closeChecklistItem.findMany({
      where: { organizationId, ...(accountingPeriodId ? { accountingPeriodId } : {}) },
      orderBy: { createdAt: 'asc' },
    })
    return res.status(200).json(items)
  }

  if (req.method === 'POST') {
    const { organizationId, accountingPeriodId, labels } = req.body || {}
    if (!organizationId || !accountingPeriodId) {
      return res.status(400).json({ error: 'organizationId and accountingPeriodId are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const items = await prisma.$transaction((tx) => createChecklistForPeriod(tx, { organizationId, accountingPeriodId, labels }))
    return res.status(201).json(items)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
