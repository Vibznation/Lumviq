import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { scoreMatch, journalLineWhereForBankAccount } from '../../../../lib/reconcile-utils'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const sessionId = req.query.sessionId as string | undefined
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
  const session = await prisma.reconciliationSession.findUnique({ where: { id: sessionId } })
  if (!session) return res.status(404).json({ error: 'session not found' })
  if (!(await userHasMembership(user.id, session.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: session.bankAccountId } })
  const bankTx = await prisma.bankTransaction.findMany({ where: { bankAccountId: session.bankAccountId, transactionDate: { gte: session.startDate, lte: session.endDate }, isCleared: false } })
  const journalLines = await prisma.journalLine.findMany({
    where: journalLineWhereForBankAccount(session.organizationId, bankAccount?.accountId) as any,
    include: { journalEntry: true },
  })

  const results: Record<string, any[]> = {}
  for (const tx of bankTx) {
    const txAmt = Number(tx.amount)
    const candidates: any[] = []
    for (const jl of journalLines) {
      const confidence = scoreMatch(
        txAmt,
        tx.transactionDate,
        tx.description || '',
        Number(jl.amount),
        jl.journalEntry.postedAt || jl.journalEntry.createdAt,
        jl.description || jl.journalEntry.description || ''
      )
      if (confidence > 0.15) {
        candidates.push({ journalLineId: jl.id, journalEntryId: jl.journalEntryId, amount: jl.amount.toString(), description: jl.description || jl.journalEntry.description, confidence: Math.round(confidence * 100) / 100 })
      }
    }
    candidates.sort((a, b) => b.confidence - a.confidence)
    results[tx.id] = candidates.slice(0, 5)
  }

  return res.status(200).json({ suggestions: results })
}
