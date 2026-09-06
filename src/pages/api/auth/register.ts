import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import prisma from '../../../server/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, password, name } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: 'User exists' })
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { email, name, passwordHash } })
  return res.status(201).json({ id: user.id, email: user.email })
}
