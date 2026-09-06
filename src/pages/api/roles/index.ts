import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Custom roles. NOTE: Role.name is globally unique in this schema (roles
 * are not tenant-scoped) — see docs/known-limitations.md. Any
 * organization member can view all roles; creating one requires a
 * globally-unique name, which the UI should hint at (e.g. prefixing with
 * the organization name) to avoid collisions across organizations.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const roles = await prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    })
    return res.status(200).json(roles)
  }

  if (req.method === 'POST') {
    const { organizationId, name, description, permissionIds } = req.body || {}
    if (!organizationId || !name) return res.status(400).json({ error: 'organizationId and name are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const existing = await prisma.role.findUnique({ where: { name } })
    if (existing) return res.status(409).json({ error: 'A role with this name already exists. Try a more specific name.' })

    const role = await prisma.role.create({
      data: {
        name,
        description: description || null,
        rolePermissions: {
          create: Array.isArray(permissionIds) ? permissionIds.map((permissionId: string) => ({ permissionId })) : [],
        },
      },
      include: { rolePermissions: { include: { permission: true } } },
    })
    return res.status(201).json(role)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
