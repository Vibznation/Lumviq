import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../../../components/marketing/MarketingLayout'
import { brand } from '../../../lib/brand'

export default function MonthEndCloseGuide() {
  return (
    <MarketingLayout
      title="Running your first month-end close"
      description="A step-by-step checklist for closing an accounting period in Lumviq."
      path="/resources/guides/month-end-close"
    >
      <article className="max-w-3xl mx-auto px-4 pt-16 pb-20">
        <Link href="/resources" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← Back to resources</Link>
        <h1 className="mt-4 text-3xl md:text-4xl font-semibold text-midnight-900 dark:text-white">
          Running your first month-end close
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-6 text-gray-700 dark:text-gray-300">
          <p>
            Closing a month means confirming every transaction for that period is recorded, reconciled, and
            reviewed — then locking the period so it can&rsquo;t be changed by accident. Here&rsquo;s the checklist
            we recommend inside {brand.name}.
          </p>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">1. Reconcile every bank account</h2>
          <p>
            Go to <strong>Banking → Reconcile</strong> for each account and confirm the ending balance matches your
            bank statement. {brand.name}&rsquo;s reconciliation suggestions will flag likely matches, but you make
            the final call on every match.
          </p>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">2. Review outstanding invoices and bills</h2>
          <p>
            Check <strong>Reports → AR aging</strong> and <strong>AP aging</strong> for anything overdue. Send
            reminders for unpaid invoices and confirm all vendor bills for the period are entered.
          </p>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">3. Post recurring and adjusting entries</h2>
          <p>
            Confirm recurring transactions (subscriptions, rent) have posted for the month, and record any manual
            adjusting entries — accrued expenses, prepaid amortization, depreciation on fixed assets — from
            <strong> Accounting → Journal Entries</strong>.
          </p>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">4. Review the trial balance and financial statements</h2>
          <p>
            Open <strong>Reports → Financials</strong> to review the trial balance, profit &amp; loss, and balance
            sheet for the period. Investigate any account balance that looks unexpected before closing.
          </p>
          <h2 className="text-lg font-semibold text-midnight-900 dark:text-white">5. Close the period</h2>
          <p>
            Once everything above is confirmed, go to <strong>Accounting → Close Checklist</strong> and mark each
            item complete, then close the period. Closed periods reject new or edited postings — if a correction is
            needed later, {brand.name} requires a reversing entry in an open period rather than silently editing
            closed history.
          </p>
        </div>
      </article>
    </MarketingLayout>
  )
}
