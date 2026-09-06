import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { organizationId, bankAccountId, startDate, endDate } = req.body
  if (!organizationId || !bankAccountId || !startDate || !endDate) return res.status(400).json({ error: 'organizationId, bankAccountId, startDate, endDate required' })
  const session = await prisma.reconciliationSession.create({ data: { organizationId, bankAccountId, startDate, endDate } })
  return res.status(201).json(session)
}
