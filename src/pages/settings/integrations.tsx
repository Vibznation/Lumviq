import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import PageHeader from '../../components/PageHeader'
import { useAuth, authHeaders } from '../../lib/auth-context'

type StatusResponse = {
  payroll: { mode: 'sandbox' | 'check' | 'none'; connected: boolean }
  payments: { mode: 'sandbox' | 'stripe' | 'none'; name: string; configured: boolean }
  bankFeeds: { mode: 'sandbox' | 'plaid' | 'none'; name: string; configured: boolean }
  ocr: { mode: 'sandbox' | 'vision' | 'none'; name: string; configured: boolean }
}

const PAYROLL_DESCRIPTION = 'Calculate tax withholding, file payroll tax returns, and pay employees/contractors via direct deposit.'
const PAYROLL_DETAIL_NOT_CONNECTED = 'Requires a licensed payroll provider (e.g. Check, Gusto Embedded) to be contracted and connected, with API credentials set as server environment variables (PAYROLL_PROVIDER_MODE and provider secrets) by a deployment administrator. Until a provider is connected, use the manual "Enter provider totals" fallback on the Payroll page.'
const PAYROLL_DETAIL_SANDBOX = 'Connected to a sandbox (test-mode) payroll provider. The full onboarding, calculation, approval, direct-deposit and tax-filing lifecycle is exercised end to end, but no real payments or tax filings occur. Go to the Payroll page to onboard your company, employees and contractors.'
const PAYROLL_DETAIL_CHECK = 'Connected to Check, a licensed embedded-payroll provider. Onboarding, calculation, approval, direct deposit and tax filing now run against a real provider account. Go to the Payroll page to onboard your company, employees and contractors.'

function IntegrationsContent() {
  const { currentOrg, token } = useAuth()
  const [status, setStatus] = React.useState<StatusResponse | null>(null)

  React.useEffect(() => {
    if (!token) return
    fetch('/api/integrations/status', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (json) setStatus(json) })
      .catch(() => {})
  }, [token])

  const payrollMode = status?.payroll.mode || 'none'
  const paymentsMode = status?.payments.mode || 'none'
  const bankFeedMode = status?.bankFeeds.mode || 'none'
  const ocrMode = status?.ocr.mode || 'none'

  const integrations = [
    {
      name: 'Bank feeds',
      description: 'Automatically import transactions from a bank or card via a licensed aggregator (e.g. Plaid-style provider).',
      status: bankFeedMode === 'sandbox' ? 'Sandbox (test mode)' : bankFeedMode === 'plaid' ? 'Connected (Plaid)' : 'Not connected',
      detail: bankFeedMode === 'sandbox'
        ? 'Connected to Sandbox Bank Feed. Automated sync is enabled with simulated checking & savings feeds on the Banking page.'
        : bankFeedMode === 'plaid'
        ? 'Connected to Plaid. Real-time bank transactions and account aggregation are enabled.'
        : 'Requires API credentials from a licensed aggregator (PLAID_CLIENT_ID / PLAID_SECRET). Until connected, import bank activity manually via CSV/OFX on the Banking page.',
      linkText: 'Go to Banking →',
      linkHref: '/banking/reconcile',
    },
    {
      name: 'Payment processing',
      description: 'Accept card or ACH payments on invoices and settle them automatically via online guest portal checkout.',
      status: paymentsMode === 'sandbox' ? 'Sandbox (test mode)' : paymentsMode === 'stripe' ? 'Connected (Stripe)' : 'Not connected',
      detail: paymentsMode === 'sandbox'
        ? 'Connected to Sandbox Payment Processor. Customers can pay invoices online directly through the view-only invoice portal.'
        : paymentsMode === 'stripe'
        ? 'Connected to Stripe. Direct online credit card and ACH invoice payment processing is active.'
        : 'Requires a licensed payment processor account (STRIPE_SECRET_KEY). Until connected, record payments manually on each invoice.',
      linkText: 'Go to Invoices →',
      linkHref: '/sales/invoices',
    },
    {
      name: 'Receipt / bill OCR',
      description: 'Automatically extract vendor, amount, dates, and line items from scanned receipts or bills.',
      status: ocrMode === 'sandbox' ? 'Sandbox (test mode)' : ocrMode === 'vision' ? 'Connected (AI Vision)' : 'Not connected',
      detail: ocrMode === 'sandbox'
        ? 'Connected to Sandbox OCR extraction. Upload receipt or bill images in the New Bill form to auto-fill line items.'
        : ocrMode === 'vision'
        ? 'Connected to AI Vision OCR document processing service.'
        : 'Requires an OCR/document-extraction provider. Until connected, enter bill and receipt details manually.',
      linkText: 'Create Bill with OCR →',
      linkHref: '/purchasing/bills/new',
    },
    {
      name: 'Full-service payroll',
      description: PAYROLL_DESCRIPTION,
      status: payrollMode === 'sandbox' ? 'Sandbox (test mode)' : payrollMode === 'check' ? 'Connected (Check)' : 'Not connected',
      detail: payrollMode === 'sandbox' ? PAYROLL_DETAIL_SANDBOX : payrollMode === 'check' ? PAYROLL_DETAIL_CHECK : PAYROLL_DETAIL_NOT_CONNECTED,
      linkText: 'Go to Payroll →',
      linkHref: '/payroll',
    },
  ]

  return (
    <div className="max-w-2xl">
      <PageHeader icon="🔌" eyebrow="Settings" title="Integrations" subtitle={currentOrg?.name} />

      <div className="space-y-4">
        {integrations.map((integration) => (
          <div key={integration.name} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-midnight-900 dark:text-white">{integration.name}</h2>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                integration.status.startsWith('Connected') || integration.status.startsWith('Sandbox')
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-midnight-800 dark:text-gray-300'
              }`}>
                {integration.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{integration.description}</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{integration.detail}</p>
            {integration.linkHref && (
              <p className="mt-2 text-xs">
                <Link href={integration.linkHref} className="text-teal-700 dark:text-teal-400 hover:underline">
                  {integration.linkText}
                </Link>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  return (
    <ProtectedRoute>
      <IntegrationsContent />
    </ProtectedRoute>
  )
}
