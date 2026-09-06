import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest } from '../../../lib/authorization'
import { validateJournalEntry, JournalEntry } from '../../../lib/ledger'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const body = req.body
    const entry = validateJournalEntry(body) as JournalEntry
    // set idempotency key if not provided
    if (!entry.idempotencyKey) return res.status(400).json({ error: 'idempotencyKey required' })
    const result = await (await import('../../../lib/ledger')).postJournalEntry({ prisma, actorId: user.id }, entry)
    return res.status(201).json(result)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
