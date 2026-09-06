import React, { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import MarketingLayout from '../components/marketing/MarketingLayout'
import { brand } from '../lib/brand'
import { track } from '../lib/analytics'
import { PLANS, ADD_ONS, BillingCycle, PlanId, planMonthlyEquivalent, computeOrderSummary } from '../lib/plans'

const STEPS = ['Plan', 'Add-ons', 'Review'] as const

function parseStep(q: unknown): number {
  const n = Array.isArray(q) ? Number(q[0]) : Number(q)
  return n >= 1 && n <= 3 ? n : 1
}

function parseAddOns(q: unknown): string[] {
  const raw = Array.isArray(q) ? q[0] : q
  if (!raw || typeof raw !== 'string') return []
  return raw.split(',').filter((id) => ADD_ONS.some((a) => a.id === id))
}

export default function CheckoutPage() {
  const router = useRouter()
  const ready = router.isReady

  const step = parseStep(router.query.step)
  const planId = (typeof router.query.plan === 'string' && PLANS.some((p) => p.id === router.query.plan) ? router.query.plan : 'free') as PlanId
  const cycle: BillingCycle = router.query.billing === 'annual' ? 'annual' : 'monthly'
  const selectedAddOns = parseAddOns(router.query.addons)

  const plan = PLANS.find((p) => p.id === planId)!

  function updateQuery(next: Record<string, string | undefined>) {
    const merged = { ...router.query, ...next }
    Object.keys(merged).forEach((k) => {
      if (merged[k] === undefined) delete merged[k]
    })
    router.push({ pathname: '/checkout', query: merged }, undefined, { shallow: true })
  }

  function goToStep(n: number) {
    updateQuery({ step: String(n) })
  }

  function toggleAddOn(id: string) {
    const set = new Set(selectedAddOns)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    updateQuery({ addons: Array.from(set).join(',') || undefined })
  }

  const summary = useMemo(
    () => computeOrderSummary({ planId, cycle, addOnIds: selectedAddOns }),
    [planId, cycle, selectedAddOns]
  )

  const signupHref = `/signup?plan=${planId}&billing=${cycle}${selectedAddOns.length ? `&addons=${selectedAddOns.join(',')}` : ''}`

  if (!ready) return null

  return (
    <MarketingLayout title="Checkout" description={`Choose your ${brand.name} plan and add-ons.`} path="/checkout">
      <section className="max-w-3xl mx-auto px-4 pt-16 pb-10">
        <ol className="flex items-center justify-center gap-4 mb-10" aria-label="Checkout steps">
          {STEPS.map((label, i) => {
            const n = i + 1
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  aria-current={step === n ? 'step' : undefined}
                  className={
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ' +
                    (step === n
                      ? 'bg-teal-600 text-white'
                      : step > n
                      ? 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-midnight-800 dark:text-gray-400')
                  }
                >
                  {n}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
              </li>
            )
          })}
        </ol>

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-semibold text-midnight-900 dark:text-white text-center mb-2">Choose your plan</h1>
            <div className="flex justify-center gap-2 mb-8">
              <button
                type="button"
                onClick={() => updateQuery({ billing: 'monthly' })}
                aria-pressed={cycle === 'monthly'}
                className={'rounded-full px-4 py-1.5 text-sm font-medium ' + (cycle === 'monthly' ? 'bg-teal-600 text-white' : 'border border-gray-300 dark:border-midnight-700 text-gray-600 dark:text-gray-300')}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => updateQuery({ billing: 'annual' })}
                aria-pressed={cycle === 'annual'}
                className={'rounded-full px-4 py-1.5 text-sm font-medium ' + (cycle === 'annual' ? 'bg-teal-600 text-white' : 'border border-gray-300 dark:border-midnight-700 text-gray-600 dark:text-gray-300')}
              >
                Annual
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {PLANS.map((p) => {
                const monthlyEquivalent = planMonthlyEquivalent(p.id, cycle)
                const selected = p.id === planId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => updateQuery({ plan: p.id })}
                    aria-pressed={selected}
                    className={
                      'text-left rounded-lg border p-4 ' +
                      (selected ? 'border-teal-500 ring-2 ring-teal-500' : 'border-gray-200 dark:border-midnight-800')
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-midnight-800 dark:text-white">{p.name}</span>
                      <span className="text-sm font-semibold text-midnight-900 dark:text-white">
                        {monthlyEquivalent === null ? 'Custom' : `$${monthlyEquivalent}/mo`}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{p.designedFor.join(' \u00b7 ')}</p>
                  </button>
                )
              })}
            </div>
            <div className="mt-8 flex justify-end">
              {plan.monthlyPrice === null ? (
                <Link href="/contact-sales" className="rounded-md bg-teal-600 text-white px-6 py-2.5 font-medium hover:bg-teal-700">
                  Contact sales instead
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    track('plan_selected', { planId, cycle })
                    goToStep(2)
                  }}
                  className="rounded-md bg-teal-600 text-white px-6 py-2.5 font-medium hover:bg-teal-700"
                >
                  Continue
                </button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-semibold text-midnight-900 dark:text-white text-center mb-8">Add optional add-ons</h1>
            <div className="space-y-3">
              {ADD_ONS.map((a) => {
                const checked = selectedAddOns.includes(a.id)
                return (
                  <label
                    key={a.id}
                    className={
                      'flex items-start gap-3 rounded-lg border p-4 cursor-pointer ' +
                      (checked ? 'border-teal-500 ring-1 ring-teal-500' : 'border-gray-200 dark:border-midnight-800')
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        toggleAddOn(a.id)
                        track('addon_selected', { addOnId: a.id, checked: !checked })
                      }}
                      className="mt-1"
                    />
                    <span className="flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-midnight-800 dark:text-white">{a.name}</span>
                        <span className="text-sm font-semibold text-midnight-900 dark:text-white shrink-0">
                          {a.monthlyPrice === null ? 'Contact sales' : `$${a.monthlyPrice}/mo`}
                        </span>
                      </span>
                      <span className="block mt-1 text-xs text-gray-500 dark:text-gray-400">{a.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="mt-8 flex justify-between">
              <button type="button" onClick={() => goToStep(1)} className="rounded-md border border-gray-300 dark:border-midnight-700 px-6 py-2.5 font-medium text-gray-700 dark:text-gray-200">
                Back
              </button>
              <button type="button" onClick={() => goToStep(3)} className="rounded-md bg-teal-600 text-white px-6 py-2.5 font-medium hover:bg-teal-700">
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-2xl font-semibold text-midnight-900 dark:text-white text-center mb-8">Review your order</h1>
            <div className="rounded-lg border border-gray-200 dark:border-midnight-800 p-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">{summary.planName} ({summary.cycle})</span>
                <span className="font-medium text-midnight-900 dark:text-white">
                  {summary.planCharge === null ? 'Custom' : `$${summary.planCharge}`}
                </span>
              </div>
              {summary.addOns.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{a.name}</span>
                  <span className="font-medium text-midnight-900 dark:text-white">
                    {a.charge === null ? 'Contact sales' : `$${a.charge}`}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-200 dark:border-midnight-800 pt-3 flex items-center justify-between">
                <span className="font-semibold text-midnight-900 dark:text-white">
                  {summary.hasCustomPricing ? 'Subtotal (excludes custom items)' : 'Total'}
                </span>
                <span className="font-semibold text-midnight-900 dark:text-white">${summary.subtotal}</span>
              </div>
              {summary.hasCustomPricing && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  One or more selected items require a custom quote from our sales team and are not included above.
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">{summary.renewalNote}</p>
            </div>

            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              No payment is collected here. Create your account to start your plan, and billing details will only be
              requested once a payment processor is configured for your organization.
            </p>

            <div className="mt-8 flex justify-between">
              <button type="button" onClick={() => goToStep(2)} className="rounded-md border border-gray-300 dark:border-midnight-700 px-6 py-2.5 font-medium text-gray-700 dark:text-gray-200">
                Back
              </button>
              <Link
                href={signupHref}
                onClick={() => track('signup_started', { planId, cycle, addOns: selectedAddOns })}
                className="rounded-md bg-teal-600 text-white px-6 py-2.5 font-medium hover:bg-teal-700"
              >
                Create your account
              </Link>
            </div>
          </div>
        )}
      </section>
    </MarketingLayout>
  )
}
