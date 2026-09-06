import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../components/marketing/MarketingLayout'
import { brand } from '../lib/brand'
import { INTEGRATION_CATEGORIES } from '../lib/marketing-content'

export default function IntegrationsPage() {
  return (
    <MarketingLayout
      title="Integrations"
      description={`See the categories of tools ${brand.name} is designed to connect with, including banks, payments, payroll, e-commerce and more.`}
      path="/integrations"
    >
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold text-midnight-900 dark:text-white">Connects with the tools you already use</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Lumviq is designed to integrate across these categories. Specific providers are being rolled out over time
          &mdash; we won&rsquo;t claim a connection is live until it&rsquo;s actually configured for your organization.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {INTEGRATION_CATEGORIES.map((c) => (
            <div key={c.category} className="rounded-lg border border-gray-200 dark:border-midnight-800 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-midnight-800 dark:text-white">{c.category}</h2>
                <span className="text-[10px] uppercase tracking-wide text-gold-700 dark:text-gold-400 bg-gold-50 dark:bg-midnight-800 rounded-full px-2 py-0.5">
                  Coming soon
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{c.examples.join(', ')}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-20 text-center">
        <p className="text-gray-600 dark:text-gray-400">Looking for a specific integration for your organization?</p>
        <Link href="/contact-sales" className="mt-4 inline-block rounded-md bg-teal-600 text-white px-6 py-3 font-medium hover:bg-teal-700">
          Talk to Sales
        </Link>
      </section>
    </MarketingLayout>
  )
}
