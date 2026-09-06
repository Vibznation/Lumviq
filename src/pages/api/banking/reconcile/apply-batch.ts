import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { jaccard, daysBetween } from '../../../../lib/reconcile-utils'
import { requireUserFromRequest, requireMembershipOrThrow, userHasPermission } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { sessionId, mappings, strategy } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  const session = await prisma.reconciliationSession.findUnique({ where: { id: sessionId } })
  if (!session) return res.status(404).json({ error: 'session not found' })

  try { await requireMembershipOrThrow(user.id, session.organizationId) } catch (e: any) { return res.status(403).json({ error: 'Not a member' }) }
  const hasPerm = await userHasPermission(user.id, session.organizationId, 'bank.reconcile')
  if (!hasPerm) return res.status(403).json({ error: 'Insufficient permissions' })

  const toApply: Array<{ bankTransactionId: string, journalLineId: string }> = []
  if (Array.isArray(mappings) && mappings.length > 0) {
    for (const m of mappings) toApply.push({ bankTransactionId: m.bankTransactionId, journalLineId: m.journalLineId })
  } else if (strategy === 'auto') {
    const bankTx = await prisma.bankTransaction.findMany({ where: { bankAccountId: session.bankAccountId, transactionDate: { gte: session.startDate, lte: session.endDate }, isCleared: false } })
    const journalLines = await prisma.journalLine.findMany({ where: { journalEntry: { organizationId: session.organizationId } }, include: { journalEntry: true } })
    const amountTolerance = 0.1
    const dateTolerance = 7
    for (const tx of bankTx) {
      const txAmt = Number(tx.amount)
      let best: any = null
      for (const jl of journalLines) {
        const jlAmt = Number(jl.amount)
        const rel = Math.abs(txAmt - jlAmt) / Math.max(Math.abs(txAmt), Math.abs(jlAmt), 0.01)
        const amountScore = Math.max(0, 1 - rel / amountTolerance)
        const days = daysBetween(tx.transactionDate, jl.journalEntry.postedAt || jl.journalEntry.createdAt)
        const dateScore = Math.max(0, 1 - days / dateTolerance)
        const descScore = jaccard(tx.description || '', jl.description || jl.journalEntry.description || '')
        const confidence = amountScore * 0.6 + dateScore * 0.2 + descScore * 0.2
        if (!best || confidence > best.confidence) best = { jl, confidence }
      }
      if (best && best.confidence >= 0.5) toApply.push({ bankTransactionId: tx.id, journalLineId: best.jl.id })
    }
  }

  const applied: Array<any> = []
  for (const a of toApply) {
    try {
      await prisma.$transaction(async (tx: any) => {
        const rows: any = await tx.$queryRaw`SELECT is_cleared FROM bank_transactions WHERE id = ${a.bankTransactionId} FOR UPDATE`
        const isCleared = rows && rows[0] && (rows[0].is_cleared === true || rows[0].is_cleared === 't')
        if (isCleared) return
        const item = await tx.reconciliationItem.create({ data: { sessionId, bankTransactionId: a.bankTransactionId, matched: true, matchedToJournalLineId: a.journalLineId } })
        await tx.bankTransaction.update({ where: { id: a.bankTransactionId }, data: { isCleared: true } })
        await tx.auditEvent.create({ data: { organizationId: session.organizationId, actorId: user.id, action: 'bank.reconciliation.match', resourceType: 'reconciliation_item', resourceId: item.id, newState: { bankTransactionId: a.bankTransactionId, journalLineId: a.journalLineId, sessionId } } })
        applied.push(item)
      })
    } catch (e) {
      console.error('apply error', e)
    }
  }

  return res.status(200).json({ appliedCount: applied.length, applied })
}
