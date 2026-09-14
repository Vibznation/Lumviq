import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import prisma from '../../../server/prisma'
import { checkRateLimit, clientIp } from '../../../lib/rate-limit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!checkRateLimit(`register:${clientIp(req)}`, 5, 60_000)) {
    return res.status(429).json({ error: 'Too many registration attempts, try again shortly' })
  }
  const { email, password, name } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ error: 'User exists' })
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { email, name, passwordHash } })
    return res.status(201).json({ id: user.id, email: user.email })
  } catch (err: any) {
    // Unique constraint race (two concurrent requests for the same email)
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'User exists' })
    }
    console.error('Register failed:', err)
    return res.status(500).json({ error: 'Could not create your account, please try again' })
  }
}
