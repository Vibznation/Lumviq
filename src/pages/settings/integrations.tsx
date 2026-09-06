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

function IntegrationsContent() {
  const { currentOrg } = useAuth()
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Integrations</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{currentOrg?.name}</p>

      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => (
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
