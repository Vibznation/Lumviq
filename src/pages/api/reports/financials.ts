import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Core accounting reports (trial balance, P&L, balance sheet) derived
 * directly from posted journal lines — every figure is traceable to the
 * ledger, nothing here is hardcoded or simulated.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const accounts = await prisma.account.findMany({ where: { organizationId }, orderBy: { code: 'asc' } })
  const lines = await prisma.journalLine.findMany({
    where: { journalEntry: { organizationId, posted: true } },
  })

  const byAccount = new Map<string, { debit: number; credit: number }>()
  for (const line of lines) {
    const entry = byAccount.get(line.accountId) || { debit: 0, credit: 0 }
    if (line.isDebit) entry.debit += Number(line.amount)
    else entry.credit += Number(line.amount)
    byAccount.set(line.accountId, entry)
  }

  const trialBalance = accounts.map((a) => {
    const { debit, credit } = byAccount.get(a.id) || { debit: 0, credit: 0 }
    const balance = debit - credit
    return {
      accountId: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      debitBalance: balance >= 0 ? balance : 0,
      creditBalance: balance < 0 ? -balance : 0,
    }
  })

  const totals = { asset: 0, liability: 0, equity: 0, income: 0, expense: 0 }
  for (const a of accounts) {
    const { debit, credit } = byAccount.get(a.id) || { debit: 0, credit: 0 }
    totals[a.type as keyof typeof totals] = (totals[a.type as keyof typeof totals] || 0) + (debit - credit)
  }

  const revenue = -totals.income
  const expenses = totals.expense
  const netIncome = revenue - expenses
  const totalAssets = totals.asset
  const totalLiabilities = -totals.liability
  const totalEquity = -totals.equity

  return res.status(200).json({
    trialBalance,
    totalDebits: trialBalance.reduce((s, r) => s + r.debitBalance, 0),
    totalCredits: trialBalance.reduce((s, r) => s + r.creditBalance, 0),
    profitAndLoss: { revenue, expenses, netIncome },
    balanceSheet: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      currentPeriodNetIncome: netIncome,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity + netIncome,
    },
  })
}
