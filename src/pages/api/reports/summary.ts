import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Derives a small set of overview figures directly from posted journal
 * lines. Every number here is traceable back to the ledger — nothing is
 * hardcoded or simulated.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const accounts = await prisma.account.findMany({ where: { organizationId } })
  const accountsById = new Map(accounts.map((a) => [a.id, a]))

  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { organizationId, posted: true },
      accountId: { in: accounts.map((a) => a.id) },
    },
  })

  const totals: Record<string, number> = { asset: 0, liability: 0, equity: 0, income: 0, expense: 0 }
  let cash = 0

  for (const line of lines) {
    const account = accountsById.get(line.accountId)
    if (!account) continue
    const amount = Number(line.amount)
    const signed = line.isDebit ? amount : -amount
    totals[account.type] = (totals[account.type] || 0) + signed
    if (account.subtype === 'bank') cash += signed
  }

  const revenue = -totals.income
  const expenses = totals.expense
  const netIncome = revenue - expenses

  const [accountCount, journalEntryCount, unclosedPeriods, outstandingInvoices, outstandingBills] = await Promise.all([
    prisma.account.count({ where: { organizationId } }),
    prisma.journalEntry.count({ where: { organizationId, posted: true } }),
    prisma.accountingPeriod.count({ where: { fiscalYear: { organizationId }, isClosed: false } }),
    prisma.invoice.findMany({
      where: { organizationId, status: { in: ['sent', 'partially_paid'] } },
      select: { total: true, amountPaid: true },
    }),
    prisma.bill.findMany({
      where: { organizationId, status: { in: ['open', 'partially_paid'] } },
      select: { total: true, amountPaid: true },
    }),
  ])

  const accountsReceivable = outstandingInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total) - Number(inv.amountPaid)),
    0
  )
  const accountsPayable = outstandingBills.reduce(
    (sum, bill) => sum + (Number(bill.total) - Number(bill.amountPaid)),
    0
  )

  return res.status(200).json({
    cash,
    revenue,
    expenses,
    netIncome,
    accountCount,
    journalEntryCount,
    openPeriods: unclosedPeriods,
    accountsReceivable,
    accountsPayable,
  })
}
