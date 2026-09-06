import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import { authHeaders, useAuth } from '../lib/auth-context'

type Summary = {
  cash: number
  revenue: number
  expenses: number
  netIncome: number
  accountCount: number
  journalEntryCount: number
  openPeriods: number
  accountsReceivable: number
}

function currency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function DashboardContent() {
  const { token, currentOrg } = useAuth()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    fetch(`/api/reports/summary?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load overview')
        setSummary(await res.json())
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [currentOrg?.id, token])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Overview</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card label="Cash position" value={currency(summary.cash)} />
            <Card label="Revenue" value={currency(summary.revenue)} />
            <Card label="Expenses" value={currency(summary.expenses)} />
            <Card
              label="Net income"
              value={currency(summary.netIncome)}
              tone={summary.netIncome >= 0 ? 'positive' : 'negative'}
            />
            <Card label="Outstanding to collect" value={currency(summary.accountsReceivable)} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ledger status</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {summary.accountCount} accounts &middot; {summary.journalEntryCount} posted journal entries &middot;{' '}
                {summary.openPeriods} open accounting period{summary.openPeriods === 1 ? '' : 's'}
              </p>
              <Link href="/accounting/chart-of-accounts" className="mt-3 inline-block text-sm text-teal-700 dark:text-teal-400 hover:underline">
                View chart of accounts →
              </Link>
            </div>

            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sales</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create invoices, record customer payments and track what's owed.
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <Link href="/sales/invoices" className="text-teal-700 dark:text-teal-400 hover:underline">Invoices →</Link>
                <Link href="/sales/customers" className="text-teal-700 dark:text-teal-400 hover:underline">Customers →</Link>
              </div>
            </div>

            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Banking</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Import bank transactions and reconcile accounts against posted entries.
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <Link href="/banking/import" className="text-teal-700 dark:text-teal-400 hover:underline">Import CSV →</Link>
                <Link href="/banking/reconcile" className="text-teal-700 dark:text-teal-400 hover:underline">Reconcile →</Link>
              </div>
            </div>
          </div>

          <p className="mt-8 text-xs text-gray-400">
            Bills, payroll, inventory and forecasting are not implemented yet — see the product roadmap.
          </p>
        </>
      ) : null}
    </div>
  )
}

function Card({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={
          'mt-1 text-lg font-semibold ' +
          (tone === 'positive'
            ? 'text-green-700 dark:text-green-400'
            : tone === 'negative'
            ? 'text-red-700 dark:text-red-400'
            : 'text-midnight-900 dark:text-white')
        }
      >
        {value}
      </p>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}
