import { describe, it, expect } from 'vitest'
import {
  PLANS,
  ADD_ONS,
  FEATURE_CATALOG,
  getPlan,
  planHasFeature,
  cheapestPlanForFeature,
  planPrice,
  planMonthlyEquivalent,
  annualSavings,
  addOnMonthlyPrice,
  computeOrderSummary,
  ANNUAL_MONTHS_CHARGED,
} from '../src/lib/plans'

describe('plans.ts pricing calculations', () => {
  it('charges annual billing at ANNUAL_MONTHS_CHARGED months', () => {
    const grow = getPlan('grow')
    expect(planPrice('grow', 'monthly')).toBe(grow.monthlyPrice)
    expect(planPrice('grow', 'annual')).toBe(grow.monthlyPrice! * ANNUAL_MONTHS_CHARGED)
  })

  it('returns null price for custom/contact-sales plans', () => {
    expect(planPrice('enterprise', 'monthly')).toBeNull()
    expect(planPrice('enterprise', 'annual')).toBeNull()
    expect(planMonthlyEquivalent('enterprise', 'annual')).toBeNull()
    expect(annualSavings('enterprise')).toBeNull()
  })

  it('computes an honest, non-inflated annual savings figure', () => {
    const start = getPlan('start')
    const expectedSavings = start.monthlyPrice! * 12 - start.monthlyPrice! * ANNUAL_MONTHS_CHARGED
    expect(annualSavings('start')).toBe(expectedSavings)
    expect(annualSavings('start')).toBeGreaterThan(0)
  })

  it('divides the annual charge evenly across 12 months for the displayed monthly-equivalent price', () => {
    const scale = getPlan('scale')
    const equivalent = planMonthlyEquivalent('scale', 'annual')
    expect(equivalent).toBeCloseTo((scale.monthlyPrice! * ANNUAL_MONTHS_CHARGED) / 12, 2)
  })

  it('throws for unknown plan ids', () => {
    expect(() => getPlan('does-not-exist')).toThrow()
  })
})

describe('plans.ts cumulative feature inheritance', () => {
  const order: Array<(typeof PLANS)[number]['id']> = ['free', 'start', 'grow', 'scale', 'enterprise']

  it('every plan includes everything the previous plan includes ("Everything in X, plus...")', () => {
    for (let i = 1; i < order.length; i++) {
      const lower = getPlan(order[i - 1])
      const higher = getPlan(order[i])
      for (const key of lower.featureKeys) {
        expect(higher.featureKeys, `${higher.id} should inherit ${key} from ${lower.id}`).toContain(key)
      }
    }
  })

  it('higher plans strictly add features rather than only repeating them', () => {
    for (let i = 1; i < order.length; i++) {
      const lower = getPlan(order[i - 1])
      const higher = getPlan(order[i])
      expect(higher.featureKeys.length).toBeGreaterThan(lower.featureKeys.length)
    }
  })

  it('every feature key referenced by a plan exists in FEATURE_CATALOG', () => {
    const catalogKeys = new Set(FEATURE_CATALOG.map((f) => f.key))
    for (const plan of PLANS) {
      for (const key of plan.featureKeys) {
        expect(catalogKeys.has(key), `${plan.id} references unknown feature key ${key}`).toBe(true)
      }
    }
  })

  it('planHasFeature matches the plan\'s featureKeys list', () => {
    const grow = getPlan('grow')
    expect(planHasFeature('grow', grow.featureKeys[0])).toBe(true)
    expect(planHasFeature('free', 'projects.job-costing')).toBe(false)
  })

  it('cheapestPlanForFeature returns the first (cheapest) plan that includes a feature', () => {
    const plan = cheapestPlanForFeature('accounting.income-expense-tracking')
    expect(plan?.id).toBe('free')
    const enterpriseOnly = cheapestPlanForFeature('projects.job-costing')
    expect(enterpriseOnly?.id).toBe('enterprise')
    expect(cheapestPlanForFeature('not.a.real.feature')).toBeNull()
  })
})

describe('plans.ts add-ons', () => {
  it('charges add-on annual billing at ANNUAL_MONTHS_CHARGED months, same as plans', () => {
    const payroll = ADD_ONS.find((a) => a.id === 'payroll-start')!
    expect(addOnMonthlyPrice('payroll-start', 'monthly')).toBe(payroll.monthlyPrice)
    expect(addOnMonthlyPrice('payroll-start', 'annual')).toBe(payroll.monthlyPrice! * ANNUAL_MONTHS_CHARGED)
  })

  it('never invents a price for null-priced (contact-sales) add-ons', () => {
    const expertAddOns = ADD_ONS.filter((a) => a.group === 'expert')
    expect(expertAddOns.length).toBeGreaterThan(0)
    for (const a of expertAddOns) {
      expect(a.monthlyPrice).toBeNull()
      expect(addOnMonthlyPrice(a.id, 'monthly')).toBeNull()
      expect(addOnMonthlyPrice(a.id, 'annual')).toBeNull()
    }
  })
})

describe('plans.ts computeOrderSummary', () => {
  it('sums known charges and excludes custom-priced items from the subtotal', () => {
    const summary = computeOrderSummary({
      planId: 'grow',
      cycle: 'monthly',
      addOnIds: ['payroll-start', 'expert-cfo-advisory'],
    })
    const grow = getPlan('grow')
    const payroll = ADD_ONS.find((a) => a.id === 'payroll-start')!
    expect(summary.planCharge).toBe(grow.monthlyPrice)
    expect(summary.hasCustomPricing).toBe(true)
    expect(summary.subtotal).toBe(grow.monthlyPrice! + payroll.monthlyPrice!)
  })

  it('never sets hasCustomPricing when no custom-priced add-ons are selected', () => {
    const summary = computeOrderSummary({ planId: 'start', cycle: 'annual', addOnIds: ['commerce'] })
    expect(summary.hasCustomPricing).toBe(false)
  })

  it('flags custom pricing for the Enterprise plan itself', () => {
    const summary = computeOrderSummary({ planId: 'enterprise', cycle: 'monthly', addOnIds: [] })
    expect(summary.planCharge).toBeNull()
    expect(summary.hasCustomPricing).toBe(true)
    expect(summary.subtotal).toBe(0)
  })
})
