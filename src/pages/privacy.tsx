import React from 'react'
import Link from 'next/link'
import MarketingLayout from '../components/marketing/MarketingLayout'
import { brand } from '../lib/brand'

const LAST_UPDATED = 'September 14, 2026'

export default function PrivacyPolicyPage() {
  return (
    <MarketingLayout
      title="Privacy Policy"
      description={`How ${brand.name} collects, uses and protects your data.`}
      path="/privacy"
    >
      <section className="max-w-3xl mx-auto px-4 pt-16 pb-10">
        <h1 className="text-3xl md:text-4xl font-semibold text-midnight-900 dark:text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-8 text-sm leading-6 text-gray-700 dark:text-gray-300">
          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">1. Who this policy covers</h2>
            <p>
              This policy explains how {brand.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, shares and
              protects information when you visit our website, create an account, or use the {brand.name}
              application (together, the &ldquo;Service&rdquo;). It applies to visitors, registered users, and
              members of organizations administered through the Service.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">2. Information we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information:</strong> name, email address, and hashed password when you register.</li>
              <li><strong>Organization data:</strong> business name, industry, and the financial records you enter or import — chart of accounts, journal entries, invoices, bills, bank transactions, budgets, payroll data, and similar accounting records.</li>
              <li><strong>Usage data:</strong> pages visited, actions taken, and timestamps, used to operate and secure the Service (recorded in the in-app audit log visible to your organization&rsquo;s members).</li>
              <li><strong>Support data:</strong> anything you submit through support tickets or the contact form.</li>
              <li><strong>Optional integrations:</strong> if you connect a third-party bank feed, payment processor, or OCR provider (features that are opt-in and, as of this writing, not yet connected to a live provider — see <Link href="/settings/integrations" className="text-teal-700 dark:text-teal-400 hover:underline">Integrations</Link>), we would receive only the data necessary to provide that specific feature.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">3. How we use information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To provide, maintain, and secure the Service, including your organization&rsquo;s ledger, reports, and Lumviq Intelligence features.</li>
              <li>To communicate with you about your account, billing, and material changes to the Service.</li>
              <li>To detect, investigate and prevent fraud, abuse, and security incidents.</li>
              <li>To improve the Service based on aggregated, de-identified usage patterns.</li>
            </ul>
            <p className="mt-2">
              We do not sell your financial data. We do not use your organization&rsquo;s accounting records to train
              third-party models. Lumviq Intelligence features are deterministic, rule-based calculations that run
              against your own data — never a black-box model trained on other customers&rsquo; data.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">4. Sharing information</h2>
            <p>We share information only in these circumstances:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>With subprocessors who host our infrastructure and database, under contractual confidentiality obligations.</li>
              <li>With a third-party integration provider you explicitly connect (e.g. a bank-feed aggregator), and only after you authorize that connection.</li>
              <li>When required by law, subpoena, or to protect the rights, property, or safety of {brand.name}, our users, or the public.</li>
              <li>In connection with a merger, acquisition, or sale of assets, subject to this policy continuing to apply to your data.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">5. Data retention</h2>
            <p>
              We retain your organization&rsquo;s data for as long as your account is active. If you close your
              account, we retain data for a limited period to allow recovery from accidental deletion and to meet
              legal/accounting record-keeping obligations, after which it is deleted or anonymized.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">6. Your rights and choices</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access and export:</strong> every plan includes full data export at any time (see Settings → Data).</li>
              <li><strong>Correction:</strong> you can edit most account and organization data directly in the Service.</li>
              <li><strong>Deletion:</strong> you may request deletion of your account and associated data, subject to the retention exceptions above, by contacting us.</li>
              <li><strong>Marketing communications:</strong> you can opt out of non-essential emails at any time.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">7. Cookies</h2>
            <p>
              We use only essential cookies required to keep you signed in and to remember your organization
              selection. Optional analytics cookies are off by default and only activate with your consent.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">8. Security</h2>
            <p>
              Passwords are stored using salted one-way hashing. Data in transit is encrypted via TLS. Access to
              production data is restricted to authorized personnel and logged. No method of transmission or storage
              is 100% secure, and we cannot guarantee absolute security.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">9. Children&rsquo;s privacy</h2>
            <p>The Service is intended for business use and is not directed to individuals under 18.</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">10. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. We will update the &ldquo;Last updated&rdquo; date above
              and, for material changes, notify account owners by email.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">11. Contact us</h2>
            <p>
              Questions about this policy or a data request? Reach us via{' '}
              <Link href="/contact-sales" className="text-teal-700 dark:text-teal-400 hover:underline">our contact form</Link>{' '}
              or the in-app <Link href="/support" className="text-teal-700 dark:text-teal-400 hover:underline">Support</Link> page.
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  )
}
