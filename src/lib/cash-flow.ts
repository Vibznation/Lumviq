/**
 * Cash-flow statement (direct method), derived entirely from posted
 * ledger data — no separate cash-flow ledger is maintained.
 *
 * For each posted journal entry that has at least one line touching a
 * cash account (Account.subtype === 'bank'), the net cash movement of
 * that entry is computed (sum of debits minus credits on the cash
 * lines). That net movement is then classified into operating /
 * investing / financing by looking at the offsetting (non-cash) lines'
 * Account.cashFlowCategory. An account with no cashFlowCategory set
 * defaults to 'operating' (the most common case: revenue/expense
 * accounts touched by day-to-day transactions).
 *
 * If an entry has lines spanning more than one category (rare — e.g. a
 * single journal entry that pays down both an operating expense and a
 * loan principal in the same entry), the net cash movement is split
 * proportionally across the distinct non-cash-line categories touched,
 * weighted by each category's share of the non-cash amount. This keeps
 * the statement exact (categories always sum to the entry's net cash
 * movement) without requiring entries to be single-purpose.
 */

const CATEGORIES = ['operating', 'investing', 'financing'] as const
export type CashFlowCategory = (typeof CATEGORIES)[number]

function normalizeCategory(raw: string | null | undefined): CashFlowCategory {
  return raw === 'investing' || raw === 'financing' ? raw : 'operating'
}

export async function computeCashFlowStatement(
  tx: any,
  organizationId: string,
  startDate?: Date,
  endDate?: Date
) {
  const accounts = await tx.account.findMany({ where: { organizationId } })
  const accountsById = new Map(accounts.map((a: any) => [a.id, a]))
  const cashAccountIds = new Set(accounts.filter((a: any) => a.subtype === 'bank').map((a: any) => a.id))

  if (cashAccountIds.size === 0) {
    return {
      operating: 0,
      investing: 0,
      financing: 0,
      netChangeInCash: 0,
      beginningCash: 0,
      endingCash: 0,
      note: 'No bank-subtype accounts found — mark an account subtype as "bank" in the chart of accounts to enable cash-flow reporting.',
    }
  }

  // Beginning cash: net balance of all cash accounts from all posted
  // entries strictly before startDate (0 if no startDate given, i.e. all-time).
  const priorLines = startDate
    ? await tx.journalLine.findMany({
        where: {
          accountId: { in: Array.from(cashAccountIds) },
          journalEntry: { organizationId, posted: true, postedAt: { lt: startDate } },
        },
      })
    : []
  const beginningCash = priorLines.reduce(
    (s: number, l: any) => s + (l.isDebit ? Number(l.amount) : -Number(l.amount)),
    0
  )

  const dateFilter: any = {}
  if (startDate) dateFilter.gte = startDate
  if (endDate) dateFilter.lte = endDate

  const entries = await tx.journalEntry.findMany({
    where: {
      organizationId,
      posted: true,
      lines: { some: { accountId: { in: Array.from(cashAccountIds) } } },
      ...(Object.keys(dateFilter).length ? { postedAt: dateFilter } : {}),
    },
    include: { lines: true },
  })

  const totals: Record<CashFlowCategory, number> = { operating: 0, investing: 0, financing: 0 }

  for (const entry of entries) {
    const cashLines = entry.lines.filter((l: any) => cashAccountIds.has(l.accountId))
    const nonCashLines = entry.lines.filter((l: any) => !cashAccountIds.has(l.accountId))
    const netCash = cashLines.reduce(
      (s: number, l: any) => s + (l.isDebit ? Number(l.amount) : -Number(l.amount)),
      0
    )
    if (netCash === 0) continue

    if (nonCashLines.length === 0) {
      // Cash-to-cash transfer (e.g. between two bank accounts) — no P&L/balance-sheet impact, excluded.
      continue
    }

    const byCategory = new Map<CashFlowCategory, number>()
    for (const line of nonCashLines) {
      const account: any = accountsById.get(line.accountId)
      const category = normalizeCategory(account?.cashFlowCategory)
      byCategory.set(category, (byCategory.get(category) || 0) + Number(line.amount))
    }
    const nonCashTotal = Array.from(byCategory.values()).reduce((s, v) => s + v, 0)
    if (nonCashTotal === 0) continue

    for (const [category, amount] of byCategory) {
      totals[category] += netCash * (amount / nonCashTotal)
    }
  }

  const netChangeInCash = totals.operating + totals.investing + totals.financing

  return {
    operating: totals.operating,
    investing: totals.investing,
    financing: totals.financing,
    netChangeInCash,
    beginningCash,
    endingCash: beginningCash + netChangeInCash,
  }
}
