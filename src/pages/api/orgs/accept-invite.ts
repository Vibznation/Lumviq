import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const { token } = req.query
    if (!token || typeof token !== 'string') return res.status(400).json({ error: 'token required' })
    const invite = await prisma.organizationInvitation.findUnique({
      where: { token },
      include: { organization: { select: { id: true, name: true, logoUrl: true } } },
    })
    if (!invite) return res.status(404).json({ error: 'Invitation not found or has expired' })
    const isExpired = Boolean(invite.expiresAt && invite.expiresAt < new Date())
    return res.status(200).json({
      organizationId: invite.organizationId,
      organizationName: invite.organization.name,
      logoUrl: invite.organization.logoUrl,
      email: invite.email,
      role: invite.role,
      expired: isExpired,
      createdAt: invite.createdAt,
    })
  }

  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'token required' })
  const invite = await prisma.organizationInvitation.findUnique({
    where: { token },
    include: { organization: true },
  })
  if (!invite) return res.status(404).json({ error: 'Invitation not found' })
  if (invite.expiresAt && invite.expiresAt < new Date()) return res.status(410).json({ error: 'Invitation expired' })

  // create or update membership
  const existing = await prisma.organizationMembership.findFirst({ where: { userId: user.id, organizationId: invite.organizationId } })
  if (existing) {
    if (existing.role !== invite.role) {
      await prisma.organizationMembership.update({
        where: { id: existing.id },
        data: { role: invite.role },
      })
    }
    return res.status(200).json({ message: 'Already a member', organizationId: invite.organizationId, organizationName: invite.organization.name })
  }
  const mem = await prisma.organizationMembership.create({
    data: { userId: user.id, organizationId: invite.organizationId, role: invite.role },
  })
  return res.status(201).json({
    membershipId: mem.id,
    organizationId: invite.organizationId,
    organizationName: invite.organization.name,
    role: invite.role,
  })
}
