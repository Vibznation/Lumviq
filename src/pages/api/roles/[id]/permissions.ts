import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const { organizationId, permissionIds } = req.body || {}
  if (!organizationId || !Array.isArray(permissionIds)) {
    return res.status(400).json({ error: 'organizationId and permissionIds are required' })
  }
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const role = await prisma.role.findUnique({ where: { id } })
  if (!role) return res.status(404).json({ error: 'Role not found' })

  const updated = await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: id } })
    return tx.role.update({
      where: { id },
      data: { rolePermissions: { create: permissionIds.map((permissionId: string) => ({ permissionId })) } },
      include: { rolePermissions: { include: { permission: true } } },
    })
  })
  return res.status(200).json(updated)
}
