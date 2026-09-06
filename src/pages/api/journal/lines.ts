import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json([])
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  const lines = await prisma.journalLine.findMany({ where: { journalEntry: { organizationId } }, include: { journalEntry: true } })
  // map to lightweight objects
  const mapped = lines.map(l => ({ id: l.id, description: l.description, amount: l.amount.toString(), journalEntryId: l.journalEntryId, journalEntryDescription: l.journalEntry.description }))
  return res.status(200).json(mapped)
}
