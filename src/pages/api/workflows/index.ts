import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceFeature } from '../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const rules = await prisma.workflowRule.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } })
    return res.status(200).json(rules)
  }

  if (req.method === 'POST') {
    const { organizationId, name, triggerType, triggerConfig, actionType } = req.body || {}
    if (!organizationId || !name || !triggerType) {
      return res.status(400).json({ error: 'organizationId, name and triggerType are required' })
    }
    if (!['invoice_overdue', 'bill_due_soon', 'low_stock'].includes(triggerType)) {
      return res.status(400).json({ error: 'Unsupported triggerType' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceFeature(res, prisma, organizationId, 'team.workflow-automation'))) return

    const rule = await prisma.workflowRule.create({
      data: { organizationId, name, triggerType, triggerConfig: triggerConfig || {}, actionType: actionType || 'notify' },
    })
    return res.status(201).json(rule)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
