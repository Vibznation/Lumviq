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
    const vendors = await prisma.vendor.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
    return res.status(200).json(vendors)
  }

  if (req.method === 'POST') {
    const { organizationId, name, email, phone, address } = req.body || {}
    if (!organizationId || !name) return res.status(400).json({ error: 'organizationId and name are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const vendor = await prisma.vendor.create({
      data: { organizationId, name, email: email || null, phone: phone || null, address: address || null },
    })
    return res.status(201).json(vendor)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
