import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { verifyToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = auth.split(' ')[1]
  const payload = verifyToken(token)
  if (!payload || !payload.userId) return res.status(401).json({ error: 'Invalid token' })

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user) return res.status(401).json({ error: 'Invalid token' })

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })

  return res.status(200).json({
    user: { id: user.id, email: user.email, name: user.name },
    organizations: memberships.map((m) => ({
      id: m.organizationId,
      name: m.organization.name,
      role: m.role,
    })),
  })
}
