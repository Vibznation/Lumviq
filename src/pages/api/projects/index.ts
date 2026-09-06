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
    const projects = await prisma.project.findMany({
      where: { organizationId },
      include: { timeEntries: true },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(projects)
  }

  if (req.method === 'POST') {
    const { organizationId, customerId, name, budgetAmount } = req.body || {}
    if (!organizationId || !name) return res.status(400).json({ error: 'organizationId and name are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    if (customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: customerId } })
      if (!customer || customer.organizationId !== organizationId) {
        return res.status(400).json({ error: 'Customer does not belong to this organization' })
      }
    }

    const project = await prisma.project.create({
      data: { organizationId, customerId: customerId || null, name, budgetAmount: budgetAmount || null },
    })
    return res.status(201).json(project)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
