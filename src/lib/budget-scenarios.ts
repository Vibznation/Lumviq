/**
 * Budget scenario compute/apply engine. A BudgetScenario stores a list of
 * per-account adjustments (percent or fixed-amount deltas) that are
 * applied on top of a baseline for a target year:
 *   - basedOnActual = true  -> baseline is each month's actual posted
 *     activity for that account in the prior year (same month).
 *   - basedOnActual = false -> baseline is the existing Budget row for
 *     that account/month/year (0 if none exists).
 *
 * adjustments shape: Array<{ accountId: string; type: 'percent' | 'fixed'; value: number }>
 *   percent: baseline * (1 + value/100)
 *   fixed:   baseline + value (applied to every month)
 */

interface Adjustment {
  accountId: string
  type: 'percent' | 'fixed'
  value: number
}

export interface ScenarioMonthResult {
  accountId: string
  month: number
  baseline: number
  projected: number
}

async function getActualForAccountMonth(tx: any, organizationId: string, accountId: string, year: number, month: number): Promise<number> {
  const account = await tx.account.findUnique({ where: { id: accountId } })
  if (!account) return 0
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  const lines = await tx.journalLine.findMany({
    where: { accountId, journalEntry: { organizationId, posted: true, postedAt: { gte: start, lt: end } } },
  })
  const isDebitNormal = account.type === 'asset' || account.type === 'expense'
  return lines.reduce((sum: number, l: any) => sum + (l.isDebit === isDebitNormal ? Number(l.amount) : -Number(l.amount)), 0)
}

function applyAdjustment(baseline: number, adjustment: Adjustment | undefined): number {
  if (!adjustment) return baseline
  if (adjustment.type === 'percent') return Math.round(baseline * (1 + adjustment.value / 100) * 100) / 100
  return Math.round((baseline + adjustment.value) * 100) / 100
}

/**
 * Computes the projected budget for every account referenced in the
 * scenario's adjustments, for every month of `year`. Read-only — does not
 * write to the database.
 */
export async function computeScenario(tx: any, params: { organizationId: string; scenarioId: string; year: number }): Promise<ScenarioMonthResult[]> {
  const scenario = await tx.budgetScenario.findUnique({ where: { id: params.scenarioId } })
  if (!scenario) throw new Error('Budget scenario not found')
  const adjustments: Adjustment[] = scenario.adjustments as any
  const adjustmentsByAccount = new Map(adjustments.map((a) => [a.accountId, a]))

  const results: ScenarioMonthResult[] = []
  for (const accountId of adjustmentsByAccount.keys()) {
    for (let month = 1; month <= 12; month++) {
      let baseline: number
      if (scenario.basedOnActual) {
        baseline = await getActualForAccountMonth(tx, params.organizationId, accountId, params.year - 1, month)
      } else {
        const existing = await tx.budget.findUnique({
          where: { organizationId_accountId_periodMonth_periodYear: { organizationId: params.organizationId, accountId, periodMonth: month, periodYear: params.year } },
        })
        baseline = existing ? Number(existing.amount) : 0
      }
      const projected = applyAdjustment(baseline, adjustmentsByAccount.get(accountId))
      results.push({ accountId, month, baseline, projected })
    }
  }
  return results
}

/** Materializes a computed scenario into the Budget table for `year` (upserts one row per account/month). */
export async function applyScenario(tx: any, params: { organizationId: string; scenarioId: string; year: number }) {
  const results = await computeScenario(tx, params)
  const budgets = []
  for (const r of results) {
    const budget = await tx.budget.upsert({
      where: { organizationId_accountId_periodMonth_periodYear: { organizationId: params.organizationId, accountId: r.accountId, periodMonth: r.month, periodYear: params.year } },
      create: { organizationId: params.organizationId, accountId: r.accountId, periodMonth: r.month, periodYear: params.year, amount: r.projected.toString() },
      update: { amount: r.projected.toString() },
    })
    budgets.push(budget)
  }
  return budgets
}
