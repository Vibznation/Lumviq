import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Returns the organizations directly linked to `organizationId` as
 * parent/child (see Organization.parentOrganizationId) — i.e. the valid
 * counterparties for an intercompany transaction. Multi-level
 * (grandchild) hierarchies are not supported, so this is at most one
 * parent plus any number of direct children.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const org = await prisma.organization.findUnique({ where: { id: organizationId } })
  if (!org) return res.status(404).json({ error: 'Organization not found' })

  const [parent, children] = await Promise.all([
    org.parentOrganizationId
      ? prisma.organization.findUnique({ where: { id: org.parentOrganizationId }, select: { id: true, name: true } })
      : Promise.resolve(null),
    prisma.organization.findMany({ where: { parentOrganizationId: organizationId }, select: { id: true, name: true } }),
  ])

  return res.status(200).json({ parent, children })
}
