import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'token required' })
  const invite = await prisma.organizationInvitation.findUnique({ where: { token } })
  if (!invite) return res.status(404).json({ error: 'Invitation not found' })
  if (invite.expiresAt && invite.expiresAt < new Date()) return res.status(410).json({ error: 'Invitation expired' })
  // create membership
  const existing = await prisma.organizationMembership.findFirst({ where: { userId: user.id, organizationId: invite.organizationId } })
  if (existing) return res.status(200).json({ message: 'Already a member' })
  const mem = await prisma.organizationMembership.create({ data: { userId: user.id, organizationId: invite.organizationId, role: invite.role } })
  return res.status(201).json({ membershipId: mem.id })
}
