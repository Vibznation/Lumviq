import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../../../components/marketing/MarketingLayout'
import { brand } from '../../../lib/brand'

export default function IntelligenceGuide() {
  return (
    <MarketingLayout
      title="Understanding Lumviq Intelligence recommendations"
      description="How Lumviq Intelligence's deterministic, rule-based insights work and how to use them."
      path="/resources/guides/lumviq-intelligence"
    >
      <article className="max-w-3xl mx-auto px-4 pt-16 pb-20">
        <Link href="/resources" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← Back to resources</Link>
        <h1 className="mt-4 text-3xl md:text-4xl font-semibold text-midnight-900 dark:text-white">
          Understanding Lumviq Intelligence recommendations
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-6 text-gray-700 dark:text-gray-300">
          <p>
            Lumviq Intelligence surfaces insights about your own organization&rsquo;s data — it is not a black-box
            model trained on other customers&rsquo; data, and it never takes an action on your books without your
            approval. Every insight is deterministic: the same data always produces the same result, and every
            insight shows the method behind it.
          </p>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">What it looks at</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Anomaly detection:</strong> a statistical (z-score) comparison of a transaction&rsquo;s amount against its category&rsquo;s recent average, flagging outliers.</li>
            <li><strong>Cash-flow projection:</strong> a linear projection of your recent cash burn/inflow rate, used to estimate how long current reserves will last.</li>
            <li><strong>Overdue invoices:</strong> a direct query of invoices past their due date, ranked by amount and days overdue.</li>
            <li><strong>Category patterns:</strong> frequency analysis of which accounts a transaction description has historically been categorized to, used to suggest categorization.</li>
          </ul>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">Why every insight shows its basis</h2>
          <p>
            Open <strong>Intelligence → Insights</strong> and you&rsquo;ll see each recommendation paired with the
            data and method that produced it — for example, &ldquo;a $2,300 expense is 3.1x your category average
            this month&rdquo; tells you exactly what was compared. Nothing is presented as a mysterious score; you
            can always trace an insight back to the underlying transactions.
          </p>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">You&rsquo;re always in control</h2>
          <p>
            Lumviq Intelligence recommends — you review and approve. Suggested categorizations, reconciliation
            matches, and payment recommendations all require your explicit confirmation before anything posts to
            your ledger.
          </p>
        </div>
      </article>
    </MarketingLayout>
  )
}
