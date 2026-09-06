import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import MarketingLayout from '../components/marketing/MarketingLayout'
import PricingCard from '../components/marketing/PricingCard'
import FeatureComparisonTable from '../components/marketing/FeatureComparisonTable'
import FAQAccordion from '../components/marketing/FAQAccordion'
import { brand } from '../lib/brand'
import { track } from '../lib/analytics'
import {
  PLANS,
  ADD_ONS,
  BillingCycle,
  ALL_PLANS_INCLUDE,
  annualSavings,
  addOnMonthlyPrice,
  PAYMENTS_ADDON_STATUS,
  PAYROLL_ADDON_STATUS,
} from '../lib/plans'
import { FAQ_ITEMS } from '../lib/marketing-content'

const ADDON_GROUP_LABELS: Record<string, string> = {
  payroll: 'Payroll',
  payments: 'Payments',
  expert: 'Lumviq Expert',
  commerce: 'Commerce',
  nonprofit: 'Nonprofit Enhanced',
}

const ADDON_GROUP_LINKS: Record<string, string> = {
  payroll: '/payroll',
  payments: '/settings/integrations',
  commerce: '/inventory',
  nonprofit: '/settings/funds',
}

export default function PricingPage() {
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [showComparison, setShowComparison] = useState(false)

  const groupedAddOns = useMemo(() => {
    const groups: Record<string, typeof ADD_ONS> = {}
    for (const addOn of ADD_ONS) {
      groups[addOn.group] = groups[addOn.group] || []
      groups[addOn.group].push(addOn)
    }
    return groups
  }, [])

  const maxSavings = Math.max(...PLANS.map((p) => annualSavings(p.id) || 0))

  return (
    <MarketingLayout
      title="Pricing"
      description={`Compare ${brand.name} plans and add-ons. Transparent monthly and annual pricing, no long-term contract.`}
      path="/pricing"
    >
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-6 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold text-midnight-900 dark:text-white">Plans that grow with you</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Start free. Upgrade only when you need more. Cancel any time &mdash; no long-term contract.
        </p>

        <div className="mt-8 inline-flex items-center rounded-full border border-gray-200 dark:border-midnight-800 p-1">
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            aria-pressed={cycle === 'monthly'}
            className={'rounded-full px-4 py-1.5 text-sm font-medium ' + (cycle === 'monthly' ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-300')}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCycle('annual')}
            aria-pressed={cycle === 'annual'}
            className={'rounded-full px-4 py-1.5 text-sm font-medium ' + (cycle === 'annual' ? 'bg-teal-600 text-white' : 'text-gray-600 dark:text-gray-300')}
          >
            Annual{maxSavings > 0 ? ` (save up to $${maxSavings}/yr)` : ''}
          </button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          {PLANS.map((p) => (
            <PricingCard
              key={p.id}
              plan={p}
              cycle={cycle}
              ctaHref={p.monthlyPrice === null ? '/contact-sales' : `/checkout?plan=${p.id}&billing=${cycle}`}
              ctaLabel={p.monthlyPrice === null ? 'Contact sales' : p.id === 'free' ? 'Start Free' : 'Choose plan'}
            />
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-16">
        <h2 className="text-xl font-semibold text-midnight-900 dark:text-white text-center">All plans include</h2>
        <ul className="mt-6 grid sm:grid-cols-2 gap-3">
          {ALL_PLANS_INCLUDE.map((item) => (
            <li key={item} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
              <span aria-hidden="true" className="text-teal-600">&#10003;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-16 text-center">
        <button
          type="button"
          onClick={() => setShowComparison((v) => !v)}
          aria-expanded={showComparison}
          className="text-teal-700 dark:text-teal-400 font-medium hover:underline"
        >
          {showComparison ? 'Hide full feature comparison' : 'See the full feature comparison'} &darr;
        </button>
        {showComparison && (
          <div className="mt-8 text-left">
            <FeatureComparisonTable />
          </div>
        )}
      </section>

      <section id="addons" className="max-w-6xl mx-auto px-4 pb-16 scroll-mt-24">
        <h2 className="text-2xl font-semibold text-midnight-900 dark:text-white text-center">Add-ons</h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{PAYROLL_ADDON_STATUS}</p>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{PAYMENTS_ADDON_STATUS}</p>
        <div className="mt-8 space-y-10">
          {Object.entries(groupedAddOns).map(([group, addOns]) => (
            <div key={group}>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-midnight-800 dark:text-white">{ADDON_GROUP_LABELS[group] || group}</h3>
                {ADDON_GROUP_LINKS[group] && (
                  <Link href={ADDON_GROUP_LINKS[group]} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
                    Explore in app &rarr;
                  </Link>
                )}
              </div>
              <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {addOns.map((a) => {
                  const price = addOnMonthlyPrice(a.id, cycle)
                  return (
                    <div key={a.id} className="rounded-lg border border-gray-200 dark:border-midnight-800 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-midnight-800 dark:text-white text-sm">{a.name}</h4>
                        <span className="text-sm font-semibold text-midnight-900 dark:text-white shrink-0">
                          {price === null ? 'Contact sales' : `$${price}/mo`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{a.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-semibold text-midnight-900 dark:text-white text-center mb-6">Pricing questions</h2>
        <FAQAccordion items={FAQ_ITEMS} />
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-20 text-center">
        <p className="text-gray-600 dark:text-gray-400">Not sure which plan fits? Compare every plan side by side.</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link href="/compare" className="rounded-md border border-gray-300 dark:border-midnight-700 px-6 py-3 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800">
            Compare Plans
          </Link>
          <Link
            href="/contact-sales"
            onClick={() => track('cta_click', { cta: 'talk_to_sales', location: 'pricing' })}
            className="rounded-md bg-teal-600 text-white px-6 py-3 font-medium hover:bg-teal-700"
          >
            Talk to Sales
          </Link>
        </div>
      </section>
    </MarketingLayout>
  )
}
