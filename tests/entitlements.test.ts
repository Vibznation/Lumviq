import { describe, it, expect, vi } from 'vitest'
import {
  resolveEntitlements,
  hasFeature,
  hasAddOn,
  requireFeature,
  requireWithinLimit,
  EntitlementError,
  enforceFeature,
  enforceLimit,
} from '../src/lib/entitlements'
import { getPlan } from '../src/lib/plans'

describe('entitlements.ts resolveEntitlements', () => {
  it('resolves feature keys from the org\'s plan', () => {
    const entitlements = resolveEntitlements({ planId: 'free', billingCycle: 'monthly', addOns: [] })
    const free = getPlan('free')
    expect(entitlements.featureKeys.size).toBe(free.featureKeys.length)
    expect(hasFeature(entitlements, 'accounting.income-expense-tracking')).toBe(true)
    expect(hasFeature(entitlements, 'projects.job-costing')).toBe(false)
  })

  it('tracks add-ons separately from plan feature keys', () => {
    const entitlements = resolveEntitlements({ planId: 'grow', billingCycle: 'monthly', addOns: ['payroll-start'] })
    expect(entitlements.addOns).toEqual(['payroll-start'])
    expect(hasAddOn(entitlements, 'payroll-start')).toBe(true)
    expect(hasAddOn(entitlements, 'commerce')).toBe(false)
    // Add-ons are not merged into featureKeys.
    expect(entitlements.featureKeys.has('payroll-start')).toBe(false)
  })

  it('ignores unknown/retired add-on ids instead of throwing', () => {
    const entitlements = resolveEntitlements({ planId: 'free', billingCycle: 'monthly', addOns: ['retired-addon'] })
    expect(entitlements.addOns).toEqual(['retired-addon'])
    expect(hasAddOn(entitlements, 'retired-addon')).toBe(true)
  })
})

describe('entitlements.ts requireFeature', () => {
  it('does not throw when the feature is included', () => {
    const entitlements = resolveEntitlements({ planId: 'scale', billingCycle: 'monthly', addOns: [] })
    expect(() => requireFeature(entitlements, 'inventory.cogs')).not.toThrow()
  })

  it('throws an EntitlementError with an upgrade message naming the cheapest qualifying plan', () => {
    const entitlements = resolveEntitlements({ planId: 'free', billingCycle: 'monthly', addOns: [] })
    try {
      requireFeature(entitlements, 'projects.time-tracking')
      expect.unreachable('expected requireFeature to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(EntitlementError)
      expect((err as EntitlementError).upgradeMessage).toContain('Lumviq Grow')
      expect((err as EntitlementError).upgradeMessage).toContain('/pricing')
    }
  })

  it('gives a generic upgrade message for a feature key no plan includes', () => {
    const entitlements = resolveEntitlements({ planId: 'free', billingCycle: 'monthly', addOns: [] })
    try {
      requireFeature(entitlements, 'not.a.real.feature')
      expect.unreachable('expected requireFeature to throw')
    } catch (err) {
      expect((err as EntitlementError).upgradeMessage).toContain("isn't available on your current plan")
    }
  })
})

describe('entitlements.ts requireWithinLimit', () => {
  it('allows unlimited limits regardless of current count', () => {
    const entitlements = resolveEntitlements({ planId: 'enterprise', billingCycle: 'monthly', addOns: [] })
    expect(() => requireWithinLimit(entitlements, 'users', 10_000)).not.toThrow()
  })

  it('allows counts strictly below the numeric limit', () => {
    const entitlements = resolveEntitlements({ planId: 'free', billingCycle: 'monthly', addOns: [] })
    expect(() => requireWithinLimit(entitlements, 'users', 0)).not.toThrow()
  })

  it('throws once the current count reaches the numeric limit', () => {
    const entitlements = resolveEntitlements({ planId: 'free', billingCycle: 'monthly', addOns: [] })
    expect(() => requireWithinLimit(entitlements, 'users', 1)).toThrow(EntitlementError)
  })
})

function mockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

function mockTx(org: { planId: string; billingCycle?: string; addOns?: string[] } | null) {
  return { organization: { findUnique: vi.fn(async () => org) } }
}

describe('entitlements.ts enforceFeature (API route gate)', () => {
  it('returns true and does not touch res when the feature is included', async () => {
    const res = mockRes()
    const tx = mockTx({ planId: 'scale', billingCycle: 'monthly', addOns: [] })
    const ok = await enforceFeature(res, tx, 'org-1', 'inventory.cogs')
    expect(ok).toBe(true)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns false and writes a 403 with an upgradeMessage when the feature is not included', async () => {
    const res = mockRes()
    const tx = mockTx({ planId: 'free', billingCycle: 'monthly', addOns: [] })
    const ok = await enforceFeature(res, tx, 'org-1', 'projects.time-tracking')
    expect(ok).toBe(false)
    expect(res.status).toHaveBeenCalledWith(403)
    const body = res.json.mock.calls[0][0]
    expect(body.error).toContain('projects.time-tracking')
    expect(body.upgradeMessage).toContain('Lumviq Grow')
  })

  it('rethrows non-entitlement errors (e.g. org not found) instead of swallowing them', async () => {
    const res = mockRes()
    const tx = mockTx(null)
    await expect(enforceFeature(res, tx, 'missing-org', 'sales.invoices')).rejects.toThrow('Organization not found')
    expect(res.status).not.toHaveBeenCalled()
  })
})

describe('entitlements.ts enforceLimit (API route gate)', () => {
  it('returns true when the current count is below the plan limit', async () => {
    const res = mockRes()
    const tx = mockTx({ planId: 'start', billingCycle: 'monthly', addOns: [] })
    const ok = await enforceLimit(res, tx, 'org-1', 'users', 2)
    expect(ok).toBe(true)
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns false and writes a 403 once the count reaches the plan limit', async () => {
    const res = mockRes()
    const tx = mockTx({ planId: 'start', billingCycle: 'monthly', addOns: [] })
    const ok = await enforceLimit(res, tx, 'org-1', 'users', 3)
    expect(ok).toBe(false)
    expect(res.status).toHaveBeenCalledWith(403)
    const body = res.json.mock.calls[0][0]
    expect(body.upgradeMessage).toBeTruthy()
  })

  it('never blocks an unlimited limit regardless of count', async () => {
    const res = mockRes()
    const tx = mockTx({ planId: 'enterprise', billingCycle: 'monthly', addOns: [] })
    const ok = await enforceLimit(res, tx, 'org-1', 'invoicesPerMonth', 999_999)
    expect(ok).toBe(true)
    expect(res.status).not.toHaveBeenCalled()
  })
})
