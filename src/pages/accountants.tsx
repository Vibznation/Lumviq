import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../components/marketing/MarketingLayout'
import { brand } from '../lib/brand'
import { ACCOUNTANT_COLLABORATION } from '../lib/marketing-content'

const WORKFLOWS = [
  { title: 'Client organization switching', description: 'Move between every client organization you\u2019re invited to from a single account.' },
  { title: 'Accountant Mode', description: 'A dedicated view that surfaces journals, reconciliation status and open review items first.' },
  { title: 'Month-end close', description: 'Track closing periods, lock finalized periods and see what still needs review.' },
  { title: 'Review and approval workflows', description: 'Flag entries for review and approve changes with a visible audit trail.' },
  { title: 'Report exports', description: 'Export financial statements and supporting detail for your own workpapers.' },
  { title: 'Audit trails', description: 'Every posted entry and edit is attributed and timestamped.' },
]

export default function AccountantsPage() {
  return (
    <MarketingLayout
      title="For Accountants"
      description={`${brand.name} gives accountants and bookkeepers dedicated tools for client collaboration, review and month-end close.`}
      path="/accountants"
    >
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-semibold text-midnight-900 dark:text-white">Built to work the way accountants work</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Every plan includes at least one accountant invitation. Accountant Mode gives you the tools to review, reconcile and close &mdash; without slowing your clients down.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/contact-sales" className="rounded-md bg-teal-600 text-white px-6 py-3 font-medium hover:bg-teal-700">
            Talk to Sales
          </Link>
          <Link href="/pricing" className="rounded-md border border-gray-300 dark:border-midnight-700 px-6 py-3 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800">
            See Plans
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-semibold text-midnight-900 dark:text-white text-center mb-10">Accountant collaboration tools</h2>
        <ul className="grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
          {ACCOUNTANT_COLLABORATION.map((item) => (
            <li key={item} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2 rounded-lg border border-gray-200 dark:border-midnight-800 p-3">
              <span aria-hidden="true" className="text-teal-600">&#10003;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-semibold text-midnight-900 dark:text-white text-center mb-10">How accountants use Lumviq</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WORKFLOWS.map((w) => (
            <div key={w.title} className="rounded-xl border border-gray-200 dark:border-midnight-800 p-6">
              <h3 className="font-semibold text-midnight-800 dark:text-white">{w.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{w.description}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  )
}
