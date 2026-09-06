import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { verifyToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = auth.split(' ')[1]
  const payload = verifyToken(token)
  if (!payload || !payload.userId) return res.status(401).json({ error: 'Invalid token' })
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  const org = await prisma.organization.create({ data: { name } })
  await prisma.organizationMembership.create({ data: { userId: payload.userId, organizationId: org.id, role: 'owner' } })
  return res.status(201).json({ id: org.id, name: org.name })
}
