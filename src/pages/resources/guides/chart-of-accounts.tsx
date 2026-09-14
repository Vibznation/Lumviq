import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../../../components/marketing/MarketingLayout'
import { brand } from '../../../lib/brand'

export default function ChartOfAccountsGuide() {
  return (
    <MarketingLayout
      title="Setting up your chart of accounts"
      description="How to structure a chart of accounts that scales with your business in Lumviq."
      path="/resources/guides/chart-of-accounts"
    >
      <article className="max-w-3xl mx-auto px-4 pt-16 pb-20">
        <Link href="/resources" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← Back to resources</Link>
        <h1 className="mt-4 text-3xl md:text-4xl font-semibold text-midnight-900 dark:text-white">
          Setting up your chart of accounts
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-6 text-gray-700 dark:text-gray-300">
          <p>
            Your chart of accounts is the list of every account you use to categorize transactions — bank accounts,
            expense categories, revenue streams, and more. {brand.name} seeds a sensible default chart when you
            create an organization, but understanding its structure helps you customize it with confidence.
          </p>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">The five account types</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Assets</strong> — what you own: bank accounts, accounts receivable, inventory, fixed assets.</li>
            <li><strong>Liabilities</strong> — what you owe: accounts payable, loans, payroll liabilities.</li>
            <li><strong>Equity</strong> — the owner&rsquo;s stake: retained earnings, owner contributions/draws.</li>
            <li><strong>Income</strong> — money earned: sales revenue, service income, interest income.</li>
            <li><strong>Expenses</strong> — money spent: rent, software, payroll expense, cost of goods sold.</li>
          </ul>
          <p>
            Within each type, {brand.name} uses <strong>subtypes</strong> (e.g. an asset account&rsquo;s subtype of
            &ldquo;bank&rdquo; or &ldquo;receivable&rdquo;) to power automation — for example, invoice payments are
            automatically deposited to whichever account has the &ldquo;bank&rdquo; subtype, and inventory sales
            automatically post cost of goods sold using the &ldquo;cogs&rdquo; subtype.
          </p>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">Customizing your chart</h2>
          <p>
            Go to <strong>Accounting → Chart of Accounts</strong> to add, rename, or archive accounts. A few
            practical guidelines:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Keep the top-level list broad — you can always add detail with dimensions (class, department, location) instead of creating dozens of near-duplicate accounts.</li>
            <li>Never delete an account that has posted transactions; archive it instead so historical reports stay accurate.</li>
            <li>Use consistent naming (e.g. always &ldquo;Software &amp; Subscriptions&rdquo;, not a mix of &ldquo;Software&rdquo; and &ldquo;SaaS&rdquo;) so reports stay easy to read year over year.</li>
          </ul>
        </div>
      </article>
    </MarketingLayout>
  )
}
