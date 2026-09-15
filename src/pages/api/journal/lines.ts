import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json([])
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  const accountId = req.query.accountId as string | undefined
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined
  const postedAtFilter: any = {}
  if (startDate) postedAtFilter.gte = startDate
  if (endDate) postedAtFilter.lte = endDate
  const lines = await prisma.journalLine.findMany({
    where: {
      ...(accountId ? { accountId } : {}),
      journalEntry: {
        organizationId,
        ...(Object.keys(postedAtFilter).length ? { postedAt: postedAtFilter } : {}),
      },
    },
    include: { journalEntry: true },
    orderBy: { journalEntry: { postedAt: 'asc' } },
  })
  // map to lightweight objects
  const mapped = lines.map(l => ({
    id: l.id,
    accountId: l.accountId,
    description: l.description,
    amount: l.amount.toString(),
    isDebit: l.isDebit,
    journalEntryId: l.journalEntryId,
    journalEntryDescription: l.journalEntry.description,
    postedAt: l.journalEntry.postedAt,
  }))
  return res.status(200).json(mapped)
}
