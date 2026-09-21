import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import PageHeader from '../../../components/PageHeader'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Account = { id: string; code: string; name: string; type: string; subtype: string | null }

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const

function GeneralLedgerContent() {
  const { token, currentOrg } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!currentOrg) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
        if (!res.ok) throw new Error('Could not load accounts')
        setAccounts(await res.json())
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  const grouped = ACCOUNT_TYPES.map((type) => ({
    type,
    accounts: accounts.filter((a) => a.type === type),
  }))

  return (
    <div>
      <PageHeader
        icon="📚"
        eyebrow="Accounting"
        title="General Ledger"
        subtitle={`${currentOrg?.name || ''} · select an account to view every posted transaction and its running balance.`}
        quickLinks={[
          { label: 'Journal Entries', href: '/accounting/journal-entries', icon: '📒' },
          { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', icon: '⚖️' },
        ]}
      />

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-gray-500">No accounts yet.</p>
      ) : (
        <div className="space-y-6">
          {grouped.filter((g) => g.accounts.length > 0).map((g) => (
            <div key={g.type}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{g.type}</h2>
              <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-md overflow-hidden divide-y divide-gray-100 dark:divide-midnight-800">
                {g.accounts.map((a) => (
                  <Link
                    key={a.id}
                    href={`/accounting/general-ledger/${a.id}`}
                    className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-midnight-800"
                  >
                    <span className="text-gray-500 dark:text-gray-400">{a.code}</span>
                    <span className="flex-1 px-3 text-gray-900 dark:text-gray-100">{a.name}</span>
                    <span className="text-teal-700 dark:text-teal-400">View activity →</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function GeneralLedgerPage() {
  return (
    <ProtectedRoute>
      <GeneralLedgerContent />
    </ProtectedRoute>
  )
}
