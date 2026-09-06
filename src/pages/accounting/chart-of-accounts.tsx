import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Account = {
  id: string
  code: string
  name: string
  type: string
  subtype: string | null
}

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const

function ChartOfAccountsContent() {
  const { token, currentOrg } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', type: 'asset', subtype: '' })
  const [submitting, setSubmitting] = useState(false)

  async function loadAccounts() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/accounts?organizationId=${currentOrg.id}`, {
        headers: authHeaders(token),
      })
      if (!res.ok) throw new Error('Could not load accounts')
      setAccounts(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form, subtype: form.subtype || undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create account')
      }
      setForm({ code: '', name: '', type: 'asset', subtype: '' })
      setShowForm(false)
      await loadAccounts()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = ACCOUNT_TYPES.map((type) => ({
    type,
    accounts: accounts.filter((a) => a.type === type),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Chart of Accounts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentOrg?.name} &middot; every ledger posting must reference one of these accounts.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700"
        >
          {showForm ? 'Cancel' : 'Add account'}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="code" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Code</label>
            <input id="code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
            <input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label htmlFor="type" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Type</label>
            <select id="type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="subtype" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Subtype (optional)</label>
            <input id="subtype" value={form.subtype} onChange={(e) => setForm({ ...form, subtype: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-60">
              {submitting ? 'Saving…' : 'Save account'}
            </button>
          </div>
        </form>
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
              <table className="w-full text-sm border border-gray-200 dark:border-midnight-800 rounded-md overflow-hidden">
                <thead className="bg-gray-50 dark:bg-midnight-900 text-left text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Subtype</th>
                  </tr>
                </thead>
                <tbody>
                  {g.accounts.map((a) => (
                    <tr key={a.id} className="border-t border-gray-100 dark:border-midnight-800">
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{a.code}</td>
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{a.name}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{a.subtype || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChartOfAccountsPage() {
  return (
    <ProtectedRoute>
      <ChartOfAccountsContent />
    </ProtectedRoute>
  )
}
