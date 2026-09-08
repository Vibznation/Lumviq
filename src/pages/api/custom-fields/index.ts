import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceFeature } from '../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    const entityType = req.query.entityType as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const fields = await prisma.customField.findMany({
      where: { organizationId, ...(entityType ? { entityType } : {}) },
      orderBy: { createdAt: 'asc' },
    })
    return res.status(200).json(fields)
  }

  if (req.method === 'POST') {
    const { organizationId, entityType, name, fieldType, options } = req.body || {}
    if (!organizationId || !entityType || !name) {
      return res.status(400).json({ error: 'organizationId, entityType and name are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceFeature(res, prisma, organizationId, 'team.custom-fields'))) return
    const field = await prisma.customField.create({
      data: { organizationId, entityType, name, fieldType: fieldType || 'text', options: options || [] },
    })
    return res.status(201).json(field)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
