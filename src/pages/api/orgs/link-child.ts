import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest } from '../../../lib/authorization'

/**
 * Links a child organization under a parent for consolidated reporting.
 * This never merges ledgers — each organization keeps its own independent
 * chart of accounts and journal entries. Requires the requester to be an
 * owner of BOTH organizations.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { parentOrganizationId, childOrganizationId } = req.body || {}
  if (!parentOrganizationId || !childOrganizationId) {
    return res.status(400).json({ error: 'parentOrganizationId and childOrganizationId are required' })
  }
  if (parentOrganizationId === childOrganizationId) {
    return res.status(400).json({ error: 'An organization cannot be its own parent' })
  }

  const [parentMembership, childMembership, child] = await Promise.all([
    prisma.organizationMembership.findFirst({ where: { userId: user.id, organizationId: parentOrganizationId } }),
    prisma.organizationMembership.findFirst({ where: { userId: user.id, organizationId: childOrganizationId } }),
    prisma.organization.findUnique({ where: { id: childOrganizationId } }),
  ])
  if (!parentMembership || parentMembership.role !== 'owner') return res.status(403).json({ error: 'Owner access required on the parent organization' })
  if (!childMembership || childMembership.role !== 'owner') return res.status(403).json({ error: 'Owner access required on the child organization' })
  if (!child) return res.status(404).json({ error: 'Child organization not found' })

  // Prevent creating a cycle: the parent must not already be a descendant of the child.
  let cursor: string | null = parentOrganizationId
  while (cursor) {
    if (cursor === childOrganizationId) return res.status(400).json({ error: 'This would create a circular organization hierarchy' })
    const org: { parentOrganizationId: string | null } | null = await prisma.organization.findUnique({ where: { id: cursor }, select: { parentOrganizationId: true } })
    cursor = org?.parentOrganizationId ?? null
  }

  const updated = await prisma.organization.update({
    where: { id: childOrganizationId },
    data: { parentOrganizationId },
  })
  return res.status(200).json(updated)
}
