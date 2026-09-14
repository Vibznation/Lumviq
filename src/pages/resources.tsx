import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../components/marketing/MarketingLayout'
import { brand } from '../lib/brand'

const GUIDES = [
  { title: 'Getting started with double-entry accounting', href: '/resources/guides/getting-started-double-entry' },
  { title: 'Setting up your chart of accounts', href: '/resources/guides/chart-of-accounts' },
  { title: 'Running your first month-end close', href: '/resources/guides/month-end-close' },
  { title: 'Understanding Lumviq Intelligence recommendations', href: '/resources/guides/lumviq-intelligence' },
]

export default function ResourcesPage() {
  return (
    <MarketingLayout
      title="Resources"
      description={`Guides, policies and status information for ${brand.name}.`}
      path="/resources"
    >
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold text-midnight-900 dark:text-white">Resource center</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Guides and policies for getting the most out of {brand.name}.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-16">
        <ul className="divide-y divide-gray-200 dark:divide-midnight-800 border-t border-b border-gray-200 dark:border-midnight-800">
          {GUIDES.map((g) => (
            <li key={g.title} className="flex items-center justify-between py-4">
              <Link href={g.href} className="text-sm text-teal-700 dark:text-teal-400 hover:underline">{g.title}</Link>
              <span className="text-teal-700 dark:text-teal-400">&rarr;</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="privacy" className="max-w-3xl mx-auto px-4 pb-16 scroll-mt-24">
        <h2 className="text-xl font-semibold text-midnight-900 dark:text-white">Privacy</h2>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          We collect only the information needed to operate your account and provide the service, and we don&rsquo;t
          sell your financial data. Read the full{' '}
          <Link href="/privacy" className="text-teal-700 dark:text-teal-400 hover:underline">Privacy Policy</Link>.
        </p>
      </section>

      <section id="terms" className="max-w-3xl mx-auto px-4 pb-16 scroll-mt-24">
        <h2 className="text-xl font-semibold text-midnight-900 dark:text-white">Terms</h2>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          You can cancel or change your plan at any time, and your data remains exportable regardless of plan. Read
          the full <Link href="/terms" className="text-teal-700 dark:text-teal-400 hover:underline">Terms of Service</Link>.
        </p>
      </section>

      <section id="accessibility" className="max-w-3xl mx-auto px-4 pb-16 scroll-mt-24">
        <h2 className="text-xl font-semibold text-midnight-900 dark:text-white">Accessibility</h2>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          We build with keyboard navigation, screen-reader labeling and visible focus states in mind across the
          product and marketing site. If you hit an accessibility barrier, please tell us.
        </p>
      </section>

      <section id="cookies" className="max-w-3xl mx-auto px-4 pb-16 scroll-mt-24">
        <h2 className="text-xl font-semibold text-midnight-900 dark:text-white">Cookie preferences</h2>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Lumviq only uses essential cookies to keep you signed in. Optional analytics are off by default and only
          activate with your consent.
        </p>
      </section>

      <section id="status" className="max-w-3xl mx-auto px-4 pb-20 scroll-mt-24">
        <h2 className="text-xl font-semibold text-midnight-900 dark:text-white">System status</h2>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Check live, real-time operational status for {brand.name}.
        </p>
        <Link href="/status" className="mt-4 inline-block text-teal-700 dark:text-teal-400 font-medium hover:underline">
          View system status &rarr;
        </Link>
      </section>
    </MarketingLayout>
  )
}
