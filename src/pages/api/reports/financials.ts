import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Core accounting reports (trial balance, P&L, balance sheet) derived
 * directly from posted journal lines — every figure is traceable to the
 * ledger, nothing here is hardcoded or simulated.
 *
 * Query params (all optional, backward-compatible — omitting all of them
 * reproduces the original all-time/accrual behavior):
 * - startDate/endDate: restricts the P&L (revenue/expenses/netIncome) to
 *   this period. The trial balance and balance sheet remain cumulative
 *   from inception through endDate (or now), since those are point-in-time
 *   statements, not period statements.
 * - compareStartDate/compareEndDate: computes a second P&L for this period
 *   and returns it as `comparison`, for period-over-period comparison.
 * - basis: 'accrual' (default) or 'cash'. Cash basis re-derives P&L
 *   revenue/expenses from actual InvoicePayment/BillPayment records dated
 *   within the period (money that actually changed hands) instead of
 *   journal postings recorded at invoice/bill issue time. This is a
 *   simplification: cash-basis recognition only covers invoice and bill
 *   payments, not every other cash movement (e.g. payroll run postings).
 *   The trial balance/balance sheet are always accrual (the ledger itself
 *   is accrual-based).
 */

async function computePnlAccrual(organizationId: string, startDate?: Date, endDate?: Date) {
  const dateFilter: any = {}
  if (startDate) dateFilter.gte = startDate
  if (endDate) dateFilter.lte = endDate

  const lines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { organizationId, posted: true, ...(Object.keys(dateFilter).length ? { postedAt: dateFilter } : {}) },
      account: { type: { in: ['income', 'expense'] } },
    },
    include: { account: true },
  })

  let income = 0
  let expense = 0
  for (const line of lines) {
    const signed = line.isDebit ? Number(line.amount) : -Number(line.amount)
    if (line.account.type === 'income') income += signed
    else expense += signed
  }

  const revenue = -income
  const expenses = expense
  return { revenue, expenses, netIncome: revenue - expenses }
}

async function computePnlCash(organizationId: string, startDate?: Date, endDate?: Date) {
  const dateFilter: any = {}
  if (startDate) dateFilter.gte = startDate
  if (endDate) dateFilter.lte = endDate

  const [payments, billPayments] = await Promise.all([
    prisma.invoicePayment.findMany({
      where: { organizationId, ...(Object.keys(dateFilter).length ? { paymentDate: dateFilter } : {}) },
    }),
    prisma.billPayment.findMany({
      where: { organizationId, ...(Object.keys(dateFilter).length ? { paymentDate: dateFilter } : {}) },
    }),
  ])

  const revenue = payments.reduce((s, p) => s + Number(p.amount), 0)
  const expenses = billPayments.reduce((s, p) => s + Number(p.amount), 0)
  return { revenue, expenses, netIncome: revenue - expenses }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined
  const compareStartDate = req.query.compareStartDate ? new Date(req.query.compareStartDate as string) : undefined
  const compareEndDate = req.query.compareEndDate ? new Date(req.query.compareEndDate as string) : undefined
  const basis = req.query.basis === 'cash' ? 'cash' : 'accrual'

  const accounts = await prisma.account.findMany({ where: { organizationId }, orderBy: { code: 'asc' } })
  // Trial balance / balance sheet are cumulative point-in-time figures: from
  // inception through endDate (or now), never restricted by startDate.
  const lines = await prisma.journalLine.findMany({
    where: { journalEntry: { organizationId, posted: true, ...(endDate ? { postedAt: { lte: endDate } } : {}) } },
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

  const totalAssets = totals.asset
  const totalLiabilities = -totals.liability
  const totalEquity = -totals.equity

  const profitAndLoss =
    basis === 'cash' ? await computePnlCash(organizationId, startDate, endDate) : await computePnlAccrual(organizationId, startDate, endDate)
  const netIncome = profitAndLoss.netIncome

  const comparison =
    compareStartDate || compareEndDate
      ? basis === 'cash'
        ? await computePnlCash(organizationId, compareStartDate, compareEndDate)
        : await computePnlAccrual(organizationId, compareStartDate, compareEndDate)
      : undefined

  return res.status(200).json({
    trialBalance,
    totalDebits: trialBalance.reduce((s, r) => s + r.debitBalance, 0),
    totalCredits: trialBalance.reduce((s, r) => s + r.creditBalance, 0),
    profitAndLoss,
    comparison,
    basis,
    balanceSheet: {
      totalAssets,
      totalLiabilities,
      totalEquity,
      currentPeriodNetIncome: netIncome,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity + netIncome,
    },
  })
}
