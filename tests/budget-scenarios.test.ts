import { describe, it, expect, vi } from 'vitest'
import { computeScenario, applyScenario } from '../src/lib/budget-scenarios'

function mockTx({ adjustments, accountType = 'expense' }: { adjustments: unknown; accountType?: string }) {
  return {
    budgetScenario: {
      findUnique: vi.fn().mockResolvedValue({ id: 'scenario-1', basedOnActual: false, adjustments }),
    },
    account: {
      findUnique: vi.fn().mockResolvedValue({ id: 'acct-1', type: accountType }),
    },
    budget: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve({ ...create })),
    },
    journalLine: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  }
}

describe('budget-scenarios', () => {
  it('computeScenario applies a percent adjustment using the canonical array shape', async () => {
    const tx = mockTx({ adjustments: [{ accountId: 'acct-1', type: 'percent', value: 10 }] })
    const results = await computeScenario(tx as any, { organizationId: 'org-1', scenarioId: 'scenario-1', year: 2026 })
    expect(results).toHaveLength(12)
    // baseline is 0 (no existing budget), so 10% adjustment keeps it at 0
    expect(results[0]).toEqual({ accountId: 'acct-1', month: 1, baseline: 0, projected: 0 })
  })

  it('computeScenario also accepts the legacy Record<accountId, percent> shape', async () => {
    const tx = mockTx({ adjustments: { 'acct-1': 15 } })
    const results = await computeScenario(tx as any, { organizationId: 'org-1', scenarioId: 'scenario-1', year: 2026 })
    expect(results).toHaveLength(12)
    expect(results.every((r) => r.accountId === 'acct-1')).toBe(true)
  })

  it('applyScenario upserts a Budget row per account/month', async () => {
    const tx = mockTx({ adjustments: [{ accountId: 'acct-1', type: 'fixed', value: 500 }] })
    const budgets = await applyScenario(tx as any, { organizationId: 'org-1', scenarioId: 'scenario-1', year: 2026 })
    expect(budgets).toHaveLength(12)
    expect(tx.budget.upsert).toHaveBeenCalledTimes(12)
    expect(budgets[0].amount).toBe('500')
  })
})
