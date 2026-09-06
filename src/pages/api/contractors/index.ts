import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { createContractor } from '../../../lib/contractors'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const contractors = await prisma.contractor.findMany({ where: { organizationId }, include: { vendor: true }, orderBy: { name: 'asc' } })
    return res.status(200).json(contractors)
  }

  if (req.method === 'POST') {
    const { organizationId, name, email, taxIdLast4, vendorId } = req.body || {}
    if (!organizationId || !name) return res.status(400).json({ error: 'organizationId and name are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (vendorId) {
      const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
      if (!vendor || vendor.organizationId !== organizationId) {
        return res.status(400).json({ error: 'Vendor does not belong to this organization' })
      }
    }
    const contractor = await prisma.$transaction((tx) => createContractor(tx, { organizationId, name, email, taxIdLast4, vendorId }))
    return res.status(201).json(contractor)
  }

  return res.status(405).end()
}
