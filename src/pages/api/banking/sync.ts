import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { getBankFeedProvider } from '../../../lib/integrations/bank-feed'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { bankAccountId, externalAccountId, sinceDate } = req.body || {}
  if (!bankAccountId) return res.status(400).json({ error: 'bankAccountId is required' })

  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
  })
  if (!bankAccount) return res.status(404).json({ error: 'Bank account not found' })
  if (!(await userHasMembership(user.id, bankAccount.organizationId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const provider = getBankFeedProvider()
  if (!provider || !provider.isConfigured()) {
    return res.status(503).json({ error: 'Bank feed integration is not connected or configured' })
  }

  const since = sinceDate ? new Date(sinceDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const targetExtId = externalAccountId || bankAccount.accountNumber || 'default'

  try {
    const rawTransactions = await provider.listTransactions(
      bankAccount.organizationId,
      targetExtId,
      since
    )

    if (!rawTransactions || rawTransactions.length === 0) {
      return res.status(200).json({ count: 0, message: 'No new transactions found' })
    }

    // Deduplicate against existing externalIds for this bank account
    const existingExtIds = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId: bankAccount.id,
        externalId: { in: rawTransactions.map((t) => t.externalId) },
      },
      select: { externalId: true },
    })
    const existingSet = new Set(existingExtIds.map((t) => t.externalId).filter(Boolean))

    const newTransactions = rawTransactions.filter((t) => !existingSet.has(t.externalId))

    let createdCount = 0
    for (const t of newTransactions) {
      await prisma.bankTransaction.create({
        data: {
          bankAccountId: bankAccount.id,
          transactionDate: new Date(t.postedDate),
          amount: t.amount,
          description: t.description,
          externalId: t.externalId,
          importedFile: `BankFeed:${provider.name}`,
        },
      })
      createdCount++
    }

    return res.status(200).json({
      success: true,
      provider: provider.name,
      importedCount: createdCount,
      totalFetched: rawTransactions.length,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Bank feed sync failed' })
  }
}
