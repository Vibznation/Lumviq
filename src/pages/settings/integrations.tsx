import React from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { useAuth } from '../../lib/auth-context'

const INTEGRATIONS = [
  {
    name: 'Bank feeds',
    description: 'Automatically import transactions from a bank or card via a licensed aggregator (e.g. Plaid-style provider).',
    status: 'Not connected',
    detail: 'Requires API credentials from a licensed aggregator. Until connected, import bank activity manually via CSV/OFX on the Banking page.',
  },
  {
    name: 'Payment processing',
    description: 'Accept card or ACH payments on invoices and settle them automatically.',
    status: 'Not connected',
    detail: 'Requires a licensed payment processor account. Until connected, record payments manually on each invoice.',
  },
  {
    name: 'Receipt / bill OCR',
    description: 'Automatically extract vendor, amount and line items from scanned receipts or bills.',
    status: 'Not connected',
    detail: 'Requires an OCR/document-extraction provider. Until connected, enter bill and receipt details manually.',
  },
]

const PAYROLL_DESCRIPTION = 'Calculate tax withholding, file payroll tax returns, and pay employees/contractors via direct deposit.'
const PAYROLL_DETAIL_NOT_CONNECTED = 'Requires a licensed payroll provider (e.g. Check, Gusto Embedded) to be contracted and connected. Until then, Lumviq only records the accounting impact of payroll totals you enter manually — see the Payroll page.'
const PAYROLL_DETAIL_SANDBOX = 'Running in sandbox (test) mode against simplified, non-authoritative tax estimates — not a licensed provider. Do not use sandbox-calculated amounts to actually pay anyone or file taxes.'

function IntegrationsContent() {
  const { currentOrg, token } = useAuth()
  const [payrollMode, setPayrollMode] = React.useState<'sandbox' | 'none'>('none')

  React.useEffect(() => {
    if (!token) return
    fetch('/api/integrations/payroll-status', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (json?.mode === 'sandbox') setPayrollMode('sandbox') })
      .catch(() => {})
  }, [token])

  const integrations = [
    ...INTEGRATIONS,
    {
      name: 'Full-service payroll',
      description: PAYROLL_DESCRIPTION,
      status: payrollMode === 'sandbox' ? 'Sandbox (test mode)' : 'Not connected',
      detail: payrollMode === 'sandbox' ? PAYROLL_DETAIL_SANDBOX : PAYROLL_DETAIL_NOT_CONNECTED,
    },
  ]

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Integrations</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{currentOrg?.name}</p>

      <div className="space-y-4">
        {integrations.map((integration) => (
          <div key={integration.name} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-midnight-900 dark:text-white">{integration.name}</h2>
              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-midnight-800 dark:text-gray-300">
                {integration.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{integration.description}</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{integration.detail}</p>
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
