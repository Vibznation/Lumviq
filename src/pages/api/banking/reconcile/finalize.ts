import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, requireMembershipOrThrow, userHasPermission } from '../../../../lib/authorization'
import { enforceFeature } from '../../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { sessionId } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })
  const existing = await prisma.reconciliationSession.findUnique({ where: { id: sessionId } })
  if (!existing) return res.status(404).json({ error: 'session not found' })
  try { await requireMembershipOrThrow(user.id, existing.organizationId) } catch (e: any) { return res.status(403).json({ error: 'Not a member' }) }
  const hasPerm = await userHasPermission(user.id, existing.organizationId, 'bank.reconcile')
  if (!hasPerm) return res.status(403).json({ error: 'Insufficient permissions' })
  if (!(await enforceFeature(res, prisma, existing.organizationId, 'accounting.bank-reconciliation'))) return

  const unmatchedCount = await prisma.bankTransaction.count({
    where: { bankAccountId: existing.bankAccountId, transactionDate: { gte: existing.startDate, lte: existing.endDate }, isCleared: false },
  })
  const bookBalanceAgg = await prisma.bankTransaction.aggregate({
    where: { bankAccountId: existing.bankAccountId, transactionDate: { lte: existing.endDate } },
    _sum: { amount: true },
  })
  const bookBalance = Number(bookBalanceAgg._sum.amount || 0)
  const varianceFromStatement = existing.statementEndingBalance != null ? Number(existing.statementEndingBalance) - bookBalance : null

  const session = await prisma.reconciliationSession.update({ where: { id: sessionId }, data: { status: 'closed', closedAt: new Date() } })
  return res.status(200).json({ ...session, unmatchedCount, bookBalance, varianceFromStatement })
}
