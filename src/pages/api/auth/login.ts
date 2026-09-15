import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import prisma from '../../../server/prisma'
import { signToken } from '../../../lib/auth'
import { checkRateLimit, clientIp } from '../../../lib/rate-limit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!checkRateLimit(`login:${clientIp(req)}`, 10, 60_000)) {
    return res.status(429).json({ error: 'Too many login attempts, try again shortly' })
  }
  const { email, password } = req.body
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password required' })
  }
  const rawEmail = email.trim()
  const normalizedEmail = rawEmail.toLowerCase()
  if (!normalizedEmail) {
    return res.status(400).json({ error: 'email and password required' })
  }

  try {
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user && rawEmail !== normalizedEmail) {
      user = await prisma.user.findUnique({ where: { email: rawEmail } })
    }
    if (!user) {
      user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      })
    }
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    const token = signToken({ userId: user.id, email: user.email })
    return res.status(200).json({ token })
  } catch (err) {
    console.error('Error in /api/auth/login:', err)
    return res.status(500).json({ error: 'Authentication service temporarily unavailable' })
  }
}
