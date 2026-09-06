import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import prisma from '../../../server/prisma'
import { signToken } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  const token = signToken({ userId: user.id, email: user.email })
  return res.status(200).json({ token })
}
