import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../../../components/marketing/MarketingLayout'
import { brand } from '../../../lib/brand'

export default function DoubleEntryGuide() {
  return (
    <MarketingLayout
      title="Getting started with double-entry accounting"
      description="A practical introduction to double-entry bookkeeping and how it works in Lumviq."
      path="/resources/guides/getting-started-double-entry"
    >
      <article className="max-w-3xl mx-auto px-4 pt-16 pb-20">
        <Link href="/resources" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← Back to resources</Link>
        <h1 className="mt-4 text-3xl md:text-4xl font-semibold text-midnight-900 dark:text-white">
          Getting started with double-entry accounting
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-6 text-gray-700 dark:text-gray-300">
          <p>
            Double-entry accounting is the foundation every accounting system — including {brand.name} — is built
            on. Every transaction is recorded as at least two balanced entries: a <strong>debit</strong> to one
            account and a matching <strong>credit</strong> to another. The two sides must always be equal, which is
            what keeps your books mathematically consistent.
          </p>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">Debits and credits, simplified</h2>
          <p>
            Rather than memorizing rules, think of each account type and which side increases it:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Assets</strong> (bank accounts, receivables) increase with a debit.</li>
            <li><strong>Expenses</strong> increase with a debit.</li>
            <li><strong>Liabilities</strong> (bills owed, loans) increase with a credit.</li>
            <li><strong>Equity</strong> increases with a credit.</li>
            <li><strong>Income</strong> increases with a credit.</li>
          </ul>
          <p>
            For example, when you record a $500 cash sale, {brand.name} debits your bank account $500 (an asset
            increased) and credits Sales Income $500 (income increased). The entry balances because both sides
            equal $500.
          </p>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">How Lumviq applies this automatically</h2>
          <p>
            You rarely need to build journal entries by hand. When you create an invoice, record a bill, or
            reconcile a bank transaction, {brand.name} posts the correct debit/credit journal entry behind the
            scenes. Every posted entry is validated to balance before it&rsquo;s saved, and once posted it becomes
            immutable — corrections are made with reversing entries, never silent edits, so your audit trail stays
            trustworthy.
          </p>
          <p>
            To see this in action, open <strong>Accounting → Chart of Accounts</strong> to review your account
            structure, or <strong>Accounting → Journal Entries</strong> to see the entries {brand.name} has posted
            on your behalf.
          </p>
        </div>
      </article>
    </MarketingLayout>
  )
}
