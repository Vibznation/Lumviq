import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { scoreMatch, journalLineWhereForBankAccount } from '../../../../lib/reconcile-utils'
import { requireUserFromRequest, requireMembershipOrThrow, userHasPermission } from '../../../../lib/authorization'
import { enforceFeature } from '../../../../lib/entitlements'

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
  if (!(await enforceFeature(res, prisma, session.organizationId, 'accounting.bank-reconciliation'))) return

  const toApply: Array<{ bankTransactionId: string, journalLineId: string }> = []
  if (Array.isArray(mappings) && mappings.length > 0) {
    for (const m of mappings) toApply.push({ bankTransactionId: m.bankTransactionId, journalLineId: m.journalLineId })
  } else if (strategy === 'auto') {
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: session.bankAccountId } })
    const bankTx = await prisma.bankTransaction.findMany({ where: { bankAccountId: session.bankAccountId, transactionDate: { gte: session.startDate, lte: session.endDate }, isCleared: false } })
    const journalLines = await prisma.journalLine.findMany({
      where: journalLineWhereForBankAccount(session.organizationId, bankAccount?.accountId) as any,
      include: { journalEntry: true },
    })
    for (const tx of bankTx) {
      const txAmt = Number(tx.amount)
      let best: any = null
      for (const jl of journalLines) {
        const confidence = scoreMatch(
          txAmt,
          tx.transactionDate,
          tx.description || '',
          Number(jl.amount),
          jl.journalEntry.postedAt || jl.journalEntry.createdAt,
          jl.description || jl.journalEntry.description || ''
        )
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
