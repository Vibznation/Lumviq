import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../components/marketing/MarketingLayout'
import FeatureComparisonTable from '../components/marketing/FeatureComparisonTable'
import { brand } from '../lib/brand'

export default function ComparePage() {
  return (
    <MarketingLayout
      title="Compare Plans"
      description={`See exactly what's included on every ${brand.name} plan, feature by feature.`}
      path="/compare"
    >
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-8 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold text-midnight-900 dark:text-white">Compare every plan</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Every feature, every plan, side by side. No hidden tiers.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/pricing" className="rounded-md bg-teal-600 text-white px-6 py-3 font-medium hover:bg-teal-700">
            View pricing
          </Link>
          <Link href="/contact-sales" className="rounded-md border border-gray-300 dark:border-midnight-700 px-6 py-3 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800">
            Talk to Sales
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <FeatureComparisonTable />
      </section>
    </MarketingLayout>
  )
}
