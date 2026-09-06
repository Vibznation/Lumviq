import { describe, it, expect } from 'vitest'
import {
  resolveEntitlements,
  hasFeature,
  hasAddOn,
  requireFeature,
  requireWithinLimit,
  EntitlementError,
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
