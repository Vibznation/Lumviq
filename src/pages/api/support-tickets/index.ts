import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { supportTierLabel } from '../../../lib/support'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const tickets = await prisma.supportTicket.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } })
    const org = await prisma.organization.findUnique({ where: { id: organizationId } })
    return res.status(200).json({ tickets, tierLabel: org ? supportTierLabel(org.planId) : null })
  }

  if (req.method === 'POST') {
    const { organizationId, subject, message, priority } = req.body || {}
    if (!organizationId || !subject || !message) {
      return res.status(400).json({ error: 'organizationId, subject and message are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const ticket = await prisma.supportTicket.create({
      data: { organizationId, createdByUserId: user.id, subject, message, priority: priority || 'standard' },
    })
    return res.status(201).json(ticket)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
