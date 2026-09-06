import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import { brand } from '../../lib/brand'
import { INDUSTRIES } from '../../lib/marketing-content'
import { getPlan } from '../../lib/plans'

export default function SolutionsIndex() {
  return (
    <MarketingLayout
      title="Solutions by Industry"
      description={`See how ${brand.name} adapts to freelancers, small businesses, nonprofits, professional services, construction, retail and growing enterprises.`}
      path="/solutions"
    >
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold text-midnight-900 dark:text-white">Built to adapt to your organization</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          The same platform, tailored workflows. Choose your organization type at setup and Lumviq shows what matters most.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 gap-6">
          {INDUSTRIES.map((ind) => (
            <Link
              key={ind.slug}
              href={`/solutions/${ind.slug}`}
              className="rounded-xl border border-gray-200 dark:border-midnight-800 p-6 hover:border-teal-400 dark:hover:border-teal-600"
            >
              <h2 className="text-lg font-semibold text-midnight-800 dark:text-white">{ind.name}</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{ind.summary}</p>
              <p className="mt-3 text-xs font-medium text-teal-700 dark:text-teal-400">
                Recommended: {getPlan(ind.recommendedPlan).name} &rarr;
              </p>
            </Link>
          ))}
        </div>
      </section>
    </MarketingLayout>
  )
}
