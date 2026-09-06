import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { sessionId } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
  const session = await prisma.reconciliationSession.update({ where: { id: sessionId }, data: { status: 'closed', closedAt: new Date() } })
  return res.status(200).json(session)
}
