import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../components/marketing/MarketingLayout'
import { brand } from '../lib/brand'
import { SECURITY_HIGHLIGHTS } from '../lib/marketing-content'

export default function SecurityPage() {
  return (
    <MarketingLayout
      title="Security"
      description={`How ${brand.name} protects your financial data: encryption, access controls, audit trails and tenant isolation.`}
      path="/security"
    >
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold text-midnight-900 dark:text-white">Security you can verify</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Your financial data deserves real protection. We describe exactly what is in place today &mdash; and we don&rsquo;t
          display compliance badges we haven&rsquo;t actually earned.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-16">
        <ul className="grid sm:grid-cols-2 gap-4">
          {SECURITY_HIGHLIGHTS.map((s) => (
            <li key={s} className="rounded-lg border border-gray-200 dark:border-midnight-800 p-4 text-sm text-gray-700 dark:text-gray-300">
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-20">
        <h2 className="text-xl font-semibold text-midnight-900 dark:text-white">Data ownership</h2>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Your organization&rsquo;s financial data is yours. You can export it at any time, on every plan, including
          Free. Downgrading a plan never deletes your historical data &mdash; it only changes what new actions are
          available going forward.
        </p>
        <h2 className="mt-10 text-xl font-semibold text-midnight-900 dark:text-white">Reporting a security concern</h2>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          If you believe you&rsquo;ve found a security issue, please contact us so we can investigate promptly.
        </p>
        <Link href="/contact-sales" className="mt-4 inline-block text-teal-700 dark:text-teal-400 font-medium hover:underline">
          Contact us &rarr;
        </Link>
      </section>
    </MarketingLayout>
  )
}
