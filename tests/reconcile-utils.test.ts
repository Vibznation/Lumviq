import { describe, it, expect } from 'vitest'
import { jaccard, daysBetween, scoreMatch, journalLineWhereForBankAccount } from '../src/lib/reconcile-utils'

describe('reconcile-utils', () => {
  it('jaccard similarity basic', () => {
    expect(jaccard('coffee shop', 'coffee shop receipt')).toBeGreaterThan(0)
    expect(jaccard('', '')).toBe(0)
    expect(jaccard('a b c', 'x y z')).toBe(0)
  })

  it('daysBetween works', () => {
    expect(daysBetween('2026-09-01', '2026-09-03')).toBe(2)
    expect(daysBetween(undefined, '2026-09-03')).toBeGreaterThan(1000)
  })
})

describe('scoreMatch', () => {
  it('gives a high confidence for an exact amount/date/description match', () => {
    const score = scoreMatch(100, '2026-09-01', 'Acme Invoice 123', 100, '2026-09-01', 'Acme Invoice 123')
    expect(score).toBeGreaterThan(0.9)
  })

  it('gives a low confidence when amount, date, and description all diverge', () => {
    const score = scoreMatch(100, '2026-09-01', 'Acme Invoice 123', 9000, '2027-01-01', 'Unrelated Widget Co')
    expect(score).toBeLessThan(0.3)
  })

  it('penalizes amount mismatches more heavily near the tolerance boundary', () => {
    const close = scoreMatch(100, '2026-09-01', '', 101, '2026-09-01', '')
    const far = scoreMatch(100, '2026-09-01', '', 150, '2026-09-01', '')
    expect(close).toBeGreaterThan(far)
  })
})

describe('journalLineWhereForBankAccount', () => {
  it('scopes to the linked ledger account when the bank account has one', () => {
    const where = journalLineWhereForBankAccount('org-1', 'account-42')
    expect(where).toEqual({ accountId: 'account-42', journalEntry: { organizationId: 'org-1' } })
  })

  it('falls back to org-wide scoping when the bank account is not linked', () => {
    const where = journalLineWhereForBankAccount('org-1', null)
    expect(where).toEqual({ journalEntry: { organizationId: 'org-1' } })
    const whereUndefined = journalLineWhereForBankAccount('org-1', undefined)
    expect(whereUndefined).toEqual({ journalEntry: { organizationId: 'org-1' } })
  })
})
