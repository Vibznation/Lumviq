import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { organizationId, bankAccountId, transactions } = req.body
  if (!organizationId || !bankAccountId || !Array.isArray(transactions)) return res.status(400).json({ error: 'organizationId, bankAccountId and transactions required' })
  // transactions: [{ transactionDate, amount, description, externalId }]
  const created = []
  for (const t of transactions) {
    const ct = await prisma.bankTransaction.create({ data: { bankAccountId, transactionDate: t.transactionDate, amount: t.amount.toString(), description: t.description, externalId: t.externalId } })
    created.push(ct)
  }
  return res.status(201).json({ createdCount: created.length })
}
