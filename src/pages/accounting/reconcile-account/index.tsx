import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Account = { id: string; code: string; name: string; type: string; subtype: string | null }
type Reconciliation = {
  id: string
  periodEndDate: string
  statementBalance: string
  glBalance: string
  status: string
  completedAt: string | null
  account: { id: string; code: string; name: string }
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const STATUS_STYLES: Record<string, string> = {
  in_progress: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  completed: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
}

function ReconcileAccountContent() {
  const { token, currentOrg } = useAuth()
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ accountId: '', statementBalance: '' })
  const [periodEndDate, setPeriodEndDate] = useState(() => new Date().toISOString().slice(0, 10))

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [reconRes, accountsRes] = await Promise.all([
        fetch(`/api/account-reconciliations?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!reconRes.ok) throw new Error('Could not load reconciliations')
      setReconciliations(await reconRes.json())
      if (accountsRes.ok) {
        const accts: Account[] = await accountsRes.json()
        setAccounts(accts)
        if (accts.length > 0) setForm((f) => (f.accountId ? f : { ...f, accountId: accts[0].id }))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    if (!form.accountId) return setError('Select an account')
    if (!form.statementBalance) return setError('Enter the statement balance')
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account-reconciliations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          accountId: form.accountId,
          periodEndDate,
          statementBalance: form.statementBalance,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not start reconciliation')
      }
      setForm((f) => ({ ...f, statementBalance: '' }))
      setShowForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Account reconciliation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/accounting/chart-of-accounts" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Chart of accounts
          </Link>
          <Link href="/accounting/close-checklist" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Close checklist
          </Link>
          <Link href="/accounting/fixed-assets" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Fixed assets
          </Link>
          <Link href="/accounting/loans" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Loans
          </Link>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700"
          >
            {showForm ? 'Cancel' : 'Reconcile an account'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5 mb-6 grid grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Account</label>
            <select
              value={form.accountId}
              onChange={(e) => setForm({ ...form, accountId: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Period end date</label>
            <input
              type="date"
              value={periodEndDate}
              onChange={(e) => setPeriodEndDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Statement balance</label>
            <input
              value={form.statementBalance}
              onChange={(e) => setForm({ ...form, statementBalance: e.target.value })}
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-3">
            <button type="submit" disabled={busy} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              Start reconciliation
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : reconciliations.length === 0 ? (
        <p className="text-sm text-gray-500">No reconciliations yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2">Period end</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Statement balance</th>
                <th className="px-4 py-2 text-right">GL balance</th>
              </tr>
            </thead>
            <tbody>
              {reconciliations.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-midnight-800 hover:bg-gray-50 dark:hover:bg-midnight-800">
                  <td className="px-4 py-2">
                    <Link href={`/accounting/reconcile-account/${r.id}`} className="text-teal-700 dark:text-teal-400 hover:underline">
                      {r.account.code} {r.account.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(r.periodEndDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2">
                    <span className={'inline-block rounded-full px-2 py-0.5 text-xs font-medium ' + (STATUS_STYLES[r.status] || '')}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(r.statementBalance)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(r.glBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ReconcileAccountPage() {
  return (
    <ProtectedRoute>
      <ReconcileAccountContent />
    </ProtectedRoute>
  )
}
