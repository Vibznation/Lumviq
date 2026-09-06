import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { organizationId, bankAccountId, startDate, endDate } = req.body
  if (!organizationId || !bankAccountId || !startDate || !endDate) return res.status(400).json({ error: 'organizationId, bankAccountId, startDate, endDate required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } })
  if (!bankAccount || bankAccount.organizationId !== organizationId) return res.status(400).json({ error: 'Invalid bank account for this organization' })
  const session = await prisma.reconciliationSession.create({ data: { organizationId, bankAccountId, startDate, endDate } })
  return res.status(201).json(session)
}
