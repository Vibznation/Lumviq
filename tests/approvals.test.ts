import { describe, it, expect } from 'vitest'
import { amountRequiresApproval, APPROVAL_THRESHOLDS } from '../src/lib/approvals'

describe('amountRequiresApproval', () => {
  it('uses the hardcoded default threshold when no org override is given', () => {
    expect(amountRequiresApproval('bill-payment', 499)).toBe(false)
    expect(amountRequiresApproval('bill-payment', 500)).toBe(true)
  })

  it('returns false for a resource type with no configured threshold', () => {
    expect(amountRequiresApproval('unknown-type', 1_000_000)).toBe(false)
  })

  it('prefers a numeric org-configured threshold over the default', () => {
    expect(amountRequiresApproval('bill-payment', 100, { 'bill-payment': 50 })).toBe(true)
    expect(amountRequiresApproval('bill-payment', 40, { 'bill-payment': 50 })).toBe(false)
  })

  it('falls back to the default when the org override is not a number', () => {
    expect(amountRequiresApproval('bill-payment', 500, { 'bill-payment': 'unset' as any })).toBe(true)
  })

  it('gates every payroll run by default (threshold 0)', () => {
    expect(APPROVAL_THRESHOLDS['payroll-run']).toBe(0)
    expect(amountRequiresApproval('payroll-run', 0.01)).toBe(true)
  })
})
