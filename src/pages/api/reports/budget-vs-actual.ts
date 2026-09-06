import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/** Budget vs actual, by account, for a given fiscal year. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  const periodYear = req.query.periodYear ? Number(req.query.periodYear) : new Date().getFullYear()
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const budgets = await prisma.budget.findMany({
    where: { organizationId, periodYear },
    include: { account: true },
  })
  if (budgets.length === 0) return res.status(200).json({ rows: [], periodYear })

  const accountIds = Array.from(new Set(budgets.map((b) => b.accountId)))
  const yearStart = new Date(Date.UTC(periodYear, 0, 1))
  const yearEnd = new Date(Date.UTC(periodYear + 1, 0, 1))

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: { in: accountIds },
      journalEntry: { organizationId, posted: true, postedAt: { gte: yearStart, lt: yearEnd } },
    },
    include: { journalEntry: { select: { postedAt: true, createdAt: true } } },
  })

  const actualByAccountMonth = new Map<string, number>()
  for (const line of lines) {
    const account = budgets.find((b) => b.accountId === line.accountId)?.account
    if (!account) continue
    const entryDate = line.journalEntry.postedAt || line.journalEntry.createdAt
    const month = entryDate.getUTCMonth() + 1
    const key = `${line.accountId}:${month}`
    const amount = Number(line.amount)
    // Expense/asset accounts increase with debits; income/liability/equity increase with credits.
    const signed = account.type === 'income' || account.type === 'liability' || account.type === 'equity'
      ? (line.isDebit ? -amount : amount)
      : (line.isDebit ? amount : -amount)
    actualByAccountMonth.set(key, (actualByAccountMonth.get(key) || 0) + signed)
  }

  const rows = budgets.map((b) => {
    const key = `${b.accountId}:${b.periodMonth}`
    const actual = actualByAccountMonth.get(key) || 0
    const budgeted = Number(b.amount)
    return {
      accountId: b.accountId,
      accountCode: b.account.code,
      accountName: b.account.name,
      periodMonth: b.periodMonth,
      periodYear: b.periodYear,
      budgeted,
      actual,
      variance: actual - budgeted,
      variancePct: budgeted !== 0 ? ((actual - budgeted) / budgeted) * 100 : null,
    }
  })

  return res.status(200).json({ rows, periodYear })
}
