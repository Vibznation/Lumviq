import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const customFieldId = req.query.customFieldId as string | undefined
    const entityId = req.query.entityId as string | undefined
    if (!customFieldId && !entityId) return res.status(400).json({ error: 'customFieldId or entityId is required' })
    const field = customFieldId ? await prisma.customField.findUnique({ where: { id: customFieldId } }) : null
    if (customFieldId) {
      if (!field) return res.status(404).json({ error: 'Custom field not found' })
      if (!(await userHasMembership(user.id, field.organizationId))) return res.status(403).json({ error: 'Forbidden' })
    }
    const values = await prisma.customFieldValue.findMany({
      where: { ...(customFieldId ? { customFieldId } : {}), ...(entityId ? { entityId } : {}) },
    })
    return res.status(200).json(values)
  }

  if (req.method === 'POST') {
    const { customFieldId, entityId, value } = req.body || {}
    if (!customFieldId || !entityId) return res.status(400).json({ error: 'customFieldId and entityId are required' })

    const field = await prisma.customField.findUnique({ where: { id: customFieldId } })
    if (!field) return res.status(404).json({ error: 'Custom field not found' })
    if (!(await userHasMembership(user.id, field.organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const saved = await prisma.customFieldValue.upsert({
      where: { customFieldId_entityId: { customFieldId, entityId } },
      create: { customFieldId, entityId, value: value ?? null },
      update: { value: value ?? null },
    })
    return res.status(200).json(saved)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
