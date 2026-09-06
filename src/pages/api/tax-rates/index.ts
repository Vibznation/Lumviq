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
    const rates = await prisma.taxRate.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
    return res.status(200).json(rates)
  }

  if (req.method === 'POST') {
    const { organizationId, name, rate, isDefault } = req.body || {}
    if (!organizationId || !name || rate == null) return res.status(400).json({ error: 'organizationId, name and rate are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.taxRate.updateMany({ where: { organizationId }, data: { isDefault: false } })
      }
      return tx.taxRate.create({ data: { organizationId, name, rate, isDefault: !!isDefault } })
    })
    return res.status(201).json(created)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
