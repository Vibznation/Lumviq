import { describe, it, expect } from 'vitest'
import { jaccard, daysBetween } from '../src/lib/reconcile-utils'

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
