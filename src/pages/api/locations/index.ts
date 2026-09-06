import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const locations = await prisma.location.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
    return res.status(200).json(locations)
  }

  if (req.method === 'POST') {
    const { organizationId, name, address } = req.body || {}
    if (!organizationId || !name) return res.status(400).json({ error: 'organizationId and name are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const location = await prisma.location.create({ data: { organizationId, name, address: address || null } })
    return res.status(201).json(location)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
