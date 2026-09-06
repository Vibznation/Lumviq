import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { organizationId, bankAccountId, transactions } = req.body
  if (!organizationId || !bankAccountId || !Array.isArray(transactions)) return res.status(400).json({ error: 'organizationId, bankAccountId and transactions required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } })
  if (!bankAccount || bankAccount.organizationId !== organizationId) return res.status(400).json({ error: 'Invalid bank account for this organization' })
  // transactions: [{ transactionDate, amount, description, externalId }]
  const incomingExternalIds = transactions.map((t) => t.externalId).filter((id): id is string => !!id)
  const existing = incomingExternalIds.length
    ? await prisma.bankTransaction.findMany({
        where: { bankAccountId, externalId: { in: incomingExternalIds } },
        select: { externalId: true },
      })
    : []
  const existingIds = new Set(existing.map((e) => e.externalId))

  const created = []
  let skipped = 0
  for (const t of transactions) {
    if (t.externalId && existingIds.has(t.externalId)) {
      skipped += 1
      continue
    }
    const ct = await prisma.bankTransaction.create({ data: { bankAccountId, transactionDate: t.transactionDate, amount: t.amount.toString(), description: t.description, externalId: t.externalId } })
    created.push(ct)
    if (t.externalId) existingIds.add(t.externalId)
  }
  return res.status(201).json({ createdCount: created.length, skippedDuplicates: skipped })
}
