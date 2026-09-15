import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/** Lists posted journal entries (with their lines) for the Journal Entries workspace. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const entries = await prisma.journalEntry.findMany({
    where: { organizationId },
    orderBy: { postedAt: 'desc' },
    take: 200,
    include: { lines: { include: { account: { select: { code: true, name: true } } } } },
  })

  const mapped = entries.map((e) => ({
    id: e.id,
    description: e.description,
    postedAt: e.postedAt,
    idempotencyKey: e.idempotencyKey,
    lines: e.lines.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      accountCode: l.account.code,
      accountName: l.account.name,
      description: l.description,
      amount: l.amount.toString(),
      isDebit: l.isDebit,
    })),
  }))
  return res.status(200).json(mapped)
}
