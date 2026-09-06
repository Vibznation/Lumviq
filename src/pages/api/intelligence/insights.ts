import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Rule-based, deterministic insights computed directly from the
 * organization's own ledger, invoice and bill data. This is NOT an LLM
 * and does not call any external AI provider — every number here is a
 * plain statistical or accounting calculation, and each insight states
 * the data and thresholds it was derived from so it is never a
 * "mysterious score". It cannot take any action (post entries, move
 * money, run payroll, file taxes) — it only reports.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const insights: any[] = []

  // --- 1. Cash shortage forecast: linear projection from trailing 90-day burn rate ---
  const accounts = await prisma.account.findMany({ where: { organizationId } })
  const bankAccounts = accounts.filter((a) => a.subtype === 'bank')
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)

  const allBankLines = await prisma.journalLine.findMany({
    where: { accountId: { in: bankAccounts.map((a) => a.id) }, journalEntry: { organizationId, posted: true } },
  })
  const currentCash = allBankLines.reduce((s, l) => s + (l.isDebit ? Number(l.amount) : -Number(l.amount)), 0)

  const recentBankLines = await prisma.journalLine.findMany({
    where: {
      accountId: { in: bankAccounts.map((a) => a.id) },
      journalEntry: { organizationId, posted: true, postedAt: { gte: ninetyDaysAgo } },
    },
  })
  const netCashFlow90d = recentBankLines.reduce((s, l) => s + (l.isDebit ? Number(l.amount) : -Number(l.amount)), 0)
  const dailyBurn = netCashFlow90d / 90
  const daysToShortage = dailyBurn < 0 && currentCash > 0 ? Math.floor(currentCash / -dailyBurn) : null

  insights.push({
    type: 'cash_forecast',
    label: 'Cash shortage forecast',
    severity: daysToShortage != null && daysToShortage <= 60 ? 'warning' : 'info',
    summary:
      daysToShortage != null
        ? `At the current burn rate, cash could run out in approximately ${daysToShortage} days.`
        : dailyBurn >= 0
        ? 'Net cash flow over the last 90 days has been positive or flat; no shortage projected.'
        : 'Not enough bank account activity to project a cash trend.',
    basis: {
      currentCash,
      netCashFlowLast90Days: netCashFlow90d,
      averageDailyCashFlow: dailyBurn,
      method: 'Linear projection: current bank balance divided by average daily net cash flow over the trailing 90 days.',
    },
  })

  // --- 2. Overdue receivables summary (real query, no estimation) ---
  const overdueInvoices = await prisma.invoice.findMany({
    where: { organizationId, voidedAt: null, status: { in: ['sent', 'partially_paid'] }, dueDate: { lt: new Date() } },
    include: { customer: true },
  })
  const overdueTotal = overdueInvoices.reduce((s, inv) => s + (Number(inv.total) - Number(inv.amountPaid)), 0)
  insights.push({
    type: 'overdue_receivables',
    label: 'Overdue receivables',
    severity: overdueInvoices.length > 0 ? 'warning' : 'info',
    summary:
      overdueInvoices.length > 0
        ? `${overdueInvoices.length} invoice(s) totaling ${overdueTotal.toFixed(2)} are past due.`
        : 'No invoices are currently past due.',
    basis: {
      count: overdueInvoices.length,
      total: overdueTotal,
      invoices: overdueInvoices.slice(0, 10).map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer.name,
        balance: Number(inv.total) - Number(inv.amountPaid),
        dueDate: inv.dueDate,
      })),
      method: 'Direct query of invoices with status sent/partially_paid and due_date in the past.',
    },
  })

  // --- 3. Unusual transaction detection: z-score outliers on journal entry totals ---
  const entries = await prisma.journalEntry.findMany({
    where: { organizationId, posted: true },
    include: { lines: true },
    orderBy: { postedAt: 'desc' },
    take: 200,
  })
  const entryTotals = entries.map((e) => ({
    id: e.id,
    description: e.description,
    postedAt: e.postedAt,
    total: e.lines.filter((l) => l.isDebit).reduce((s, l) => s + Number(l.amount), 0),
  }))
  const mean = entryTotals.length > 0 ? entryTotals.reduce((s, e) => s + e.total, 0) / entryTotals.length : 0
  const variance = entryTotals.length > 0 ? entryTotals.reduce((s, e) => s + (e.total - mean) ** 2, 0) / entryTotals.length : 0
  const stdDev = Math.sqrt(variance)
  const outliers = stdDev > 0 ? entryTotals.filter((e) => Math.abs(e.total - mean) > 2 * stdDev) : []
  insights.push({
    type: 'unusual_transactions',
    label: 'Unusual transactions',
    severity: outliers.length > 0 ? 'warning' : 'info',
    summary:
      outliers.length > 0
        ? `${outliers.length} journal entr${outliers.length === 1 ? 'y is' : 'ies are'} more than 2 standard deviations from the recent average transaction size.`
        : 'No statistically unusual transactions detected in the most recent 200 posted entries.',
    basis: {
      sampleSize: entryTotals.length,
      averageEntryAmount: mean,
      standardDeviation: stdDev,
      threshold: '±2 standard deviations from the mean',
      outliers: outliers.slice(0, 10).map((o) => ({ description: o.description, amount: o.total, postedAt: o.postedAt })),
      method: 'Z-score outlier detection on the debit total of each posted journal entry, over the most recent 200 entries.',
    },
  })

  // --- 4. Category suggestions: most-frequently-used accounts by type, last 90 days ---
  const recentExpenseLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { organizationId, posted: true, postedAt: { gte: ninetyDaysAgo } },
      account: { type: 'expense' },
    },
    include: { account: true },
  })
  const frequency = new Map<string, { code: string; name: string; count: number }>()
  for (const line of recentExpenseLines) {
    const key = line.accountId
    const existing = frequency.get(key)
    if (existing) existing.count += 1
    else frequency.set(key, { code: line.account.code, name: line.account.name, count: 1 })
  }
  const topCategories = Array.from(frequency.values()).sort((a, b) => b.count - a.count).slice(0, 5)
  insights.push({
    type: 'category_suggestions',
    label: 'Frequently used expense categories',
    severity: 'info',
    summary:
      topCategories.length > 0
        ? `Your most-used expense categories in the last 90 days: ${topCategories.map((c) => c.name).join(', ')}.`
        : 'Not enough recent expense activity to suggest categories.',
    basis: {
      windowDays: 90,
      topCategories,
      method: 'Frequency count of expense-type accounts used in posted journal lines over the trailing 90 days.',
    },
  })

  // --- 5. Profit forecast: linear projection of net income from trailing 90-day revenue/expense run-rate ---
  const recentPnlLines = await prisma.journalLine.findMany({
    where: {
      journalEntry: { organizationId, posted: true, postedAt: { gte: ninetyDaysAgo } },
      account: { type: { in: ['income', 'expense'] } },
    },
    include: { account: true },
  })
  let recentRevenue = 0
  let recentExpense = 0
  for (const line of recentPnlLines) {
    const amount = Number(line.amount)
    if (line.account.type === 'income') recentRevenue += line.isDebit ? -amount : amount
    else recentExpense += line.isDebit ? amount : -amount
  }
  const dailyNetIncome = (recentRevenue - recentExpense) / 90
  const projectedNext30Days = dailyNetIncome * 30
  insights.push({
    type: 'profit_forecast',
    label: 'Profit forecast',
    severity: 'info',
    summary: `At the trailing 90-day run rate, net income for the next 30 days is projected to be approximately ${projectedNext30Days.toFixed(2)}.`,
    basis: {
      revenueLast90Days: recentRevenue,
      expensesLast90Days: recentExpense,
      averageDailyNetIncome: dailyNetIncome,
      projectedNext30Days,
      method: 'Linear projection: (revenue - expenses) over the trailing 90 days, divided by 90, multiplied by 30.',
    },
  })

  // --- 6. Payment recommendations: which open bills to prioritize paying first, ranked by due date then amount ---
  const openBills = await prisma.bill.findMany({
    where: { organizationId, status: { in: ['open', 'partially_paid'] } },
    include: { vendor: true },
    orderBy: [{ dueDate: 'asc' }],
    take: 10,
  })
  const paymentRecommendations = openBills.map((b) => ({
    billNumber: b.billNumber,
    vendor: b.vendor.name,
    balance: Number(b.total) - Number(b.amountPaid),
    dueDate: b.dueDate,
    overdue: b.dueDate < new Date(),
  }))
  insights.push({
    type: 'payment_recommendations',
    label: 'Recommended payment order',
    severity: paymentRecommendations.some((p) => p.overdue) ? 'warning' : 'info',
    summary:
      paymentRecommendations.length > 0
        ? `${paymentRecommendations.length} open bill(s) ranked by due date, earliest first.`
        : 'No open bills to prioritize.',
    basis: {
      recommendations: paymentRecommendations,
      method: 'Open/partially-paid bills sorted by due date ascending (earliest due first), limited to 10.',
    },
  })

  // --- 7. Reconciliation match suggestions: unreconciled bank transactions likely matching an open invoice/bill by amount ---
  const unreconciled = await prisma.bankTransaction.findMany({
    where: { bankAccount: { organizationId }, isCleared: false },
    take: 25,
  })
  const openInvoicesForMatch = await prisma.invoice.findMany({
    where: { organizationId, status: { in: ['sent', 'partially_paid'] } },
  })
  const openBillsForMatch = await prisma.bill.findMany({
    where: { organizationId, status: { in: ['open', 'partially_paid'] } },
  })
  const reconciliationSuggestions: any[] = []
  for (const txn of unreconciled) {
    const amount = Math.abs(Number(txn.amount))
    const invoiceMatch = openInvoicesForMatch.find((inv) => Math.abs(Number(inv.total) - Number(inv.amountPaid) - amount) < 0.01)
    const billMatch = openBillsForMatch.find((b) => Math.abs(Number(b.total) - Number(b.amountPaid) - amount) < 0.01)
    if (invoiceMatch) {
      reconciliationSuggestions.push({ bankTransactionId: txn.id, description: txn.description, amount, matchType: 'invoice', matchNumber: invoiceMatch.invoiceNumber })
    } else if (billMatch) {
      reconciliationSuggestions.push({ bankTransactionId: txn.id, description: txn.description, amount, matchType: 'bill', matchNumber: billMatch.billNumber })
    }
  }
  insights.push({
    type: 'reconciliation_suggestions',
    label: 'Reconciliation match suggestions',
    severity: 'info',
    summary:
      reconciliationSuggestions.length > 0
        ? `${reconciliationSuggestions.length} unreconciled bank transaction(s) match an open invoice or bill by exact outstanding amount.`
        : 'No exact-amount matches found among unreconciled bank transactions.',
    basis: {
      suggestions: reconciliationSuggestions,
      method: 'Exact-amount match (within $0.01) between an unreconciled bank transaction and the outstanding balance of an open invoice or bill.',
    },
  })

  // --- 8. Management summary: narrative rollup of the above, for board/executive reporting ---
  insights.push({
    type: 'management_summary',
    label: 'Management summary',
    severity: 'info',
    summary: `Cash on hand is ${currentCash.toFixed(2)}. ${overdueInvoices.length} invoice(s) totaling ${overdueTotal.toFixed(2)} are overdue. Projected 30-day net income is ${projectedNext30Days.toFixed(2)}.`,
    basis: {
      currentCash,
      overdueReceivablesTotal: overdueTotal,
      projectedNext30DaysNetIncome: projectedNext30Days,
      method: 'Narrative rollup composed directly from the cash_forecast, overdue_receivables and profit_forecast insights computed above; no new calculation.',
    },
  })

  // Log every computation for audit purposes (see prompt.md's AI
  // INTELLIGENCE requirement to log suggestions/insights). This is a log
  // of a deterministic calculation, not a model interaction.
  await prisma.aiInteraction.create({
    data: {
      organizationId,
      userId: user.id,
      kind: 'intelligence.insights',
      basis: insights.map((i) => i.type).join(','),
      inputSummary: { organizationId },
      outputSummary: { insightCount: insights.length, types: insights.map((i) => i.type) },
    },
  })

  return res.status(200).json({ insights, generatedAt: new Date().toISOString() })
}

