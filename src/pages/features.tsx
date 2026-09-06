import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../components/marketing/MarketingLayout'
import { brand } from '../lib/brand'
import { FEATURE_CATALOG, FEATURE_CATEGORIES, cheapestPlanForFeature } from '../lib/plans'

export default function FeaturesPage() {
  return (
    <MarketingLayout
      title="Features"
      description={`Explore every module in ${brand.name}: accounting, sales, expenses, projects, inventory, planning, nonprofit fund accounting, team controls, Lumviq Intelligence and support.`}
      path="/features"
    >
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold text-midnight-900 dark:text-white">A complete platform, module by module</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Every plan starts with genuine double-entry accounting. Additional modules activate as your organization grows.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="rounded-md bg-teal-600 text-white px-6 py-3 font-medium hover:bg-teal-700">
            Start Free
          </Link>
          <Link href="/pricing" className="rounded-md border border-gray-300 dark:border-midnight-700 px-6 py-3 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800">
            See Plans
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-20 space-y-16">
        {FEATURE_CATEGORIES.map((cat) => {
          const catFeatures = FEATURE_CATALOG.filter((f) => f.category === cat.key)
          if (catFeatures.length === 0) return null
          return (
            <div key={cat.key} id={cat.key} className="scroll-mt-24">
              <h2 className="text-2xl font-semibold text-midnight-900 dark:text-white">{cat.label}</h2>
              <ul className="mt-6 grid sm:grid-cols-2 gap-3">
                {catFeatures.map((f) => {
                  const plan = cheapestPlanForFeature(f.key)
                  return (
                    <li key={f.key} className="rounded-lg border border-gray-200 dark:border-midnight-800 p-4 flex items-start justify-between gap-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{f.label}</span>
                      {plan && (
                        <span className="shrink-0 text-[11px] font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-midnight-800 rounded-full px-2 py-0.5">
                          {plan.name}+
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </section>
    </MarketingLayout>
  )
}
