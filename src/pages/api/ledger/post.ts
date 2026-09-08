import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { validateJournalEntry, JournalEntry, postJournalEntry, journalEntryDebitTotal } from '../../../lib/ledger'
import { amountRequiresApproval, requestApproval } from '../../../lib/approvals'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const body = req.body
    const entry = validateJournalEntry(body) as JournalEntry
    // set idempotency key if not provided
    if (!entry.idempotencyKey) return res.status(400).json({ error: 'idempotencyKey required' })
    if (!(await userHasMembership(user.id, entry.organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const org = await prisma.organization.findUnique({ where: { id: entry.organizationId } })
    const total = journalEntryDebitTotal(entry.lines)
    if (amountRequiresApproval('journal-entry', total, org?.approvalThresholds as any)) {
      const approval = await prisma.$transaction((tx) =>
        requestApproval(tx, {
          organizationId: entry.organizationId,
          resourceType: 'journal-entry',
          resourceId: entry.idempotencyKey as string,
          amount: total,
          payload: entry,
          requestedByUserId: user.id,
          note: entry.description || 'Manual journal entry',
        })
      )
      return res.status(202).json({ requiresApproval: true, approval })
    }

    const result = await postJournalEntry({ prisma, actorId: user.id }, entry)
    return res.status(201).json(result)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
