import { describe, it, expect, vi } from 'vitest'
import { computeCashFlowStatement } from '../src/lib/cash-flow'

const bankAccount = { id: 'bank1', organizationId: 'org', subtype: 'bank', cashFlowCategory: null }
const revenueAccount = { id: 'rev1', organizationId: 'org', subtype: null, cashFlowCategory: null }
const loanAccount = { id: 'loan1', organizationId: 'org', subtype: null, cashFlowCategory: 'financing' }
const equipmentAccount = { id: 'equip1', organizationId: 'org', subtype: null, cashFlowCategory: 'investing' }

function makeTx({ accounts, priorLines = [], entries = [] }: { accounts: any[]; priorLines?: any[]; entries?: any[] }) {
  return {
    account: { findMany: vi.fn(async () => accounts) },
    journalLine: { findMany: vi.fn(async () => priorLines) },
    journalEntry: { findMany: vi.fn(async () => entries) },
  }
}

describe('computeCashFlowStatement', () => {
  it('returns a note and zeroed totals when there are no bank-subtype accounts', async () => {
    const tx = makeTx({ accounts: [revenueAccount] })
    const result = await computeCashFlowStatement(tx as any, 'org')
    expect(result.note).toMatch(/No bank-subtype accounts/)
    expect(result.operating).toBe(0)
    expect(result.netChangeInCash).toBe(0)
  })

  it('classifies a single-category entry correctly (operating, via default category)', async () => {
    const tx = makeTx({
      accounts: [bankAccount, revenueAccount],
      entries: [
        {
          lines: [
            { accountId: 'bank1', amount: '100', isDebit: true },
            { accountId: 'rev1', amount: '100', isDebit: false },
          ],
        },
      ],
    })
    const result = await computeCashFlowStatement(tx as any, 'org')
    expect(result.operating).toBe(100)
    expect(result.investing).toBe(0)
    expect(result.financing).toBe(0)
    expect(result.netChangeInCash).toBe(100)
    expect(result.beginningCash).toBe(0)
    expect(result.endingCash).toBe(100)
  })

  it('splits a multi-category entry proportionally across touched categories', async () => {
    const tx = makeTx({
      accounts: [bankAccount, loanAccount, equipmentAccount],
      entries: [
        {
          // Cash out 300: 200 to pay down a loan (financing), 100 to buy equipment (investing)
          lines: [
            { accountId: 'bank1', amount: '300', isDebit: false },
            { accountId: 'loan1', amount: '200', isDebit: true },
            { accountId: 'equip1', amount: '100', isDebit: true },
          ],
        },
      ],
    })
    const result = await computeCashFlowStatement(tx as any, 'org')
    expect(result.financing).toBeCloseTo(-200)
    expect(result.investing).toBeCloseTo(-100)
    expect(result.operating).toBe(0)
    expect(result.netChangeInCash).toBeCloseTo(-300)
  })

  it('computes beginningCash from prior lines and adds netChangeInCash for endingCash', async () => {
    const tx = makeTx({
      accounts: [bankAccount, revenueAccount],
      priorLines: [{ accountId: 'bank1', amount: '500', isDebit: true }],
      entries: [
        {
          lines: [
            { accountId: 'bank1', amount: '50', isDebit: true },
            { accountId: 'rev1', amount: '50', isDebit: false },
          ],
        },
      ],
    })
    const result = await computeCashFlowStatement(tx as any, 'org', new Date('2024-02-01'), new Date('2024-02-29'))
    expect(result.beginningCash).toBe(500)
    expect(result.netChangeInCash).toBe(50)
    expect(result.endingCash).toBe(550)
  })

  it('skips cash-to-cash transfers (no non-cash lines)', async () => {
    const tx = makeTx({
      accounts: [bankAccount],
      entries: [
        {
          lines: [
            { accountId: 'bank1', amount: '100', isDebit: true },
          ],
        },
      ],
    })
    const result = await computeCashFlowStatement(tx as any, 'org')
    expect(result.netChangeInCash).toBe(0)
  })
})
