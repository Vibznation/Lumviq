import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership, userHasPermission } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const memberships = await prisma.organizationMembership.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })

    return res.status(200).json(
      memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        role: m.role,
        joinedAt: m.createdAt,
      }))
    )
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const { organizationId, memberId, role } = req.body || {}
    if (!organizationId || !memberId || !role) {
      return res.status(400).json({ error: 'organizationId, memberId, and role are required' })
    }
    const canManage = await userHasPermission(user.id, organizationId, 'manage_organization')
    if (!canManage) {
      return res.status(403).json({ error: 'Forbidden: Only organization owners/admins can modify member roles' })
    }
    const targetMembership = await prisma.organizationMembership.findFirst({
      where: { id: memberId, organizationId },
    })
    if (!targetMembership) {
      return res.status(404).json({ error: 'Member not found' })
    }
    const updated = await prisma.organizationMembership.update({
      where: { id: memberId },
      data: { role },
      include: { user: true },
    })
    return res.status(200).json({
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      name: updated.user.name,
      role: updated.role,
    })
  }

  return res.status(405).end()
}
