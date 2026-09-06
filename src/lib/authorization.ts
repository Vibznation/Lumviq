import prisma from '../server/prisma'
import { verifyToken } from './auth'

export async function requireUserFromRequest(req: any) {
  const auth = req.headers?.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  const token = auth.split(' ')[1]
  const payload = verifyToken(token)
  if (!payload || !payload.userId) return null
  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  return user
}

export async function userHasMembership(userId: string, organizationId: string) {
  const mem = await prisma.organizationMembership.findFirst({ where: { userId, organizationId } })
  return !!mem
}

export async function requireMembershipOrThrow(userId: string, organizationId: string) {
  const ok = await userHasMembership(userId, organizationId)
  if (!ok) throw new Error('User is not a member of the organization')
  return true
}

export async function userHasPermission(userId: string, organizationId: string, permissionName: string) {
  const membership = await prisma.organizationMembership.findFirst({ where: { userId, organizationId }, include: { roleRef: { include: { rolePermissions: { include: { permission: true } } } } } })
  if (!membership) return false
  const perms = membership.roleRef?.rolePermissions?.map((rp:any) => rp.permission.name) || []
  return perms.includes(permissionName) || membership.role === 'owner'
}
