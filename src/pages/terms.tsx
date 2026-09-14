import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../components/marketing/MarketingLayout'
import { brand } from '../lib/brand'

const LAST_UPDATED = 'September 14, 2026'

export default function TermsOfServicePage() {
  return (
    <MarketingLayout
      title="Terms of Service"
      description={`The terms that govern use of ${brand.name}.`}
      path="/terms"
    >
      <section className="max-w-3xl mx-auto px-4 pt-16 pb-10">
        <h1 className="text-3xl md:text-4xl font-semibold text-midnight-900 dark:text-white">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-8 text-sm leading-6 text-gray-700 dark:text-gray-300">
          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">1. Agreement</h2>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of {brand.name} (the
              &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these Terms on
              behalf of yourself and, if applicable, the organization you represent.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">2. The Service</h2>
            <p>
              {brand.name} is an accounting and financial-management platform, including a double-entry ledger,
              invoicing, bill management, banking, budgeting, reporting, and rule-based Lumviq Intelligence
              features. {brand.name} is a bookkeeping and reporting tool, not a licensed accounting, tax, or legal
              advisory service. You remain responsible for the accuracy of the records you enter and for compliance
              with applicable tax and financial-reporting obligations; we recommend consulting a licensed
              professional for advice specific to your situation.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">3. Accounts and organizations</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must provide accurate registration information and keep your credentials secure.</li>
              <li>You are responsible for activity that occurs under your account and for managing who has access to your organization.</li>
              <li>Each subscription plan has limits on users, accountant invitations, and other resources, described on our <Link href="/pricing" className="text-teal-700 dark:text-teal-400 hover:underline">Pricing</Link> page.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">4. Subscriptions, billing and cancellation</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Paid plans are billed on the cycle you select (monthly or annual) at the price shown at checkout.</li>
              <li>You may upgrade, downgrade, or cancel your plan at any time from Settings → Billing; changes take effect per the timing described at checkout.</li>
              <li>Downgrading never deletes your historical data — it only changes which new actions are permitted going forward.</li>
              <li>Fees are non-refundable except where required by law.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">5. Your data</h2>
            <p>
              You own the financial data you enter into the Service. You may export your data at any time, on any
              plan, from Settings → Data. We only use your data to provide the Service to you, as described in our{' '}
              <Link href="/privacy" className="text-teal-700 dark:text-teal-400 hover:underline">Privacy Policy</Link>.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">6. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Use the Service for any unlawful purpose, including fraud or money laundering.</li>
              <li>Attempt to gain unauthorized access to another organization&rsquo;s data.</li>
              <li>Reverse-engineer, resell, or use the Service to build a competing product.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">7. Third-party integrations</h2>
            <p>
              Optional integrations (bank feeds, payment processing, receipt/bill OCR) connect to third-party
              providers you choose to authorize. As of this writing no live provider is connected by default — see
              Settings → Integrations for current status. Use of a connected third-party provider is also subject
              to that provider&rsquo;s own terms.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">8. Disclaimers</h2>
            <p>
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied,
              including fitness for a particular purpose. Lumviq Intelligence features are deterministic
              calculations over your own data intended to inform, not replace, your judgment or professional advice.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">9. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, {brand.name} will not be liable for indirect, incidental, or
              consequential damages arising from your use of the Service. Our total liability for any claim is
              limited to the amount you paid for the Service in the 12 months preceding the claim.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">10. Termination</h2>
            <p>
              You may stop using the Service and cancel your subscription at any time. We may suspend or terminate
              access for violation of these Terms, with notice where practicable. Upon termination, you may export
              your data for a limited period before it is deleted per our retention practices.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">11. Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. We will update the &ldquo;Last updated&rdquo; date above
              and, for material changes, notify account owners by email before the changes take effect.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">12. Contact</h2>
            <p>
              Questions about these Terms? Reach us via{' '}
              <Link href="/contact-sales" className="text-teal-700 dark:text-teal-400 hover:underline">our contact form</Link>{' '}
              or the in-app <Link href="/support" className="text-teal-700 dark:text-teal-400 hover:underline">Support</Link> page.
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  )
}
