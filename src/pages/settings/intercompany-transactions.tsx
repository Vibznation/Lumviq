import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type LinkedOrg = { id: string; name: string }
type Account = { id: string; code: string; name: string; type: string }
type Transaction = {
  id: string
  organizationId: string
  counterpartyOrganizationId: string
  description: string | null
  amount: string
  eliminated: boolean
  createdAt: string
  organization: { name: string }
  counterpartyOrganization: { name: string }
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const emptyForm = {
  counterpartyOrganizationId: '',
  description: '',
  amount: '',
  dueFromAccountId: '',
  organizationOffsetAccountId: '',
  dueToAccountId: '',
  counterpartyOffsetAccountId: '',
}

function IntercompanyTransactionsContent() {
  const { token, currentOrg } = useAuth()
  const [linkedOrgs, setLinkedOrgs] = useState<LinkedOrg[]>([])
  const [ownAccounts, setOwnAccounts] = useState<Account[]>([])
  const [counterpartyAccounts, setCounterpartyAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [linkedRes, ownAccountsRes, txRes] = await Promise.all([
        fetch(`/api/orgs/linked?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/intercompany-transactions?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (linkedRes.ok) {
        const { parent, children } = await linkedRes.json()
        setLinkedOrgs([...(parent ? [parent] : []), ...children])
      }
      if (ownAccountsRes.ok) setOwnAccounts(await ownAccountsRes.json())
      if (!txRes.ok) throw new Error('Could not load intercompany transactions')
      setTransactions(await txRes.json())
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

  useEffect(() => {
    async function loadCounterpartyAccounts() {
      if (!form.counterpartyOrganizationId) {
        setCounterpartyAccounts([])
        return
      }
      const res = await fetch(`/api/accounts?organizationId=${form.counterpartyOrganizationId}`, { headers: authHeaders(token) })
      setCounterpartyAccounts(res.ok ? await res.json() : [])
    }
    loadCounterpartyAccounts()
  }, [form.counterpartyOrganizationId, token])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    const { counterpartyOrganizationId, amount, dueFromAccountId, dueToAccountId, organizationOffsetAccountId, counterpartyOffsetAccountId } = form
    if (!counterpartyOrganizationId || !amount || !dueFromAccountId || !dueToAccountId || !organizationOffsetAccountId || !counterpartyOffsetAccountId) {
      return setError('Counterparty organization, amount and all four accounts are required')
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/intercompany-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form, amount: Number(amount) }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create intercompany transaction')
      }
      setForm(emptyForm)
      setShowForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleEliminate(id: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/intercompany-transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ action: 'eliminate' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not eliminate transaction')
      }
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
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Intercompany transactions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/settings/multi-entity" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Multi-entity management
          </Link>
          <button
            onClick={() => setShowForm((s) => !s)}
            disabled={linkedOrgs.length === 0}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {showForm ? 'Cancel' : 'New transaction'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {linkedOrgs.length === 0 && !loading && (
        <p className="text-sm text-gray-500 mb-4">
          No linked organizations yet — link a parent/child organization on the{' '}
          <Link href="/settings/multi-entity" className="text-teal-700 dark:text-teal-400 hover:underline">
            multi-entity management
          </Link>{' '}
          page first.
        </p>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5 mb-6 grid grid-cols-2 gap-3 items-end">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Counterparty organization</label>
            <select
              value={form.counterpartyOrganizationId}
              onChange={(e) => setForm({ ...form, counterpartyOrganizationId: e.target.value, dueToAccountId: '', counterpartyOffsetAccountId: '' })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {linkedOrgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Description (optional)</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Amount</label>
            <input
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              className="mt-1 w-full max-w-xs rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>

          <div className="col-span-2 border-t border-gray-100 dark:border-midnight-800 pt-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{currentOrg?.name} (initiating org)</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Due from affiliate (asset)</label>
            <select
              value={form.dueFromAccountId}
              onChange={(e) => setForm({ ...form, dueFromAccountId: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {ownAccounts.filter((a) => a.type === 'asset').map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Offset account (e.g. cash paid)</label>
            <select
              value={form.organizationOffsetAccountId}
              onChange={(e) => setForm({ ...form, organizationOffsetAccountId: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {ownAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2 border-t border-gray-100 dark:border-midnight-800 pt-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              {linkedOrgs.find((o) => o.id === form.counterpartyOrganizationId)?.name || 'Counterparty org'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Due to affiliate (liability)</label>
            <select
              value={form.dueToAccountId}
              onChange={(e) => setForm({ ...form, dueToAccountId: e.target.value })}
              disabled={!form.counterpartyOrganizationId}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm disabled:opacity-50"
            >
              <option value="">Select…</option>
              {counterpartyAccounts.filter((a) => a.type === 'liability').map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Offset account (e.g. cash received)</label>
            <select
              value={form.counterpartyOffsetAccountId}
              onChange={(e) => setForm({ ...form, counterpartyOffsetAccountId: e.target.value })}
              disabled={!form.counterpartyOrganizationId}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm disabled:opacity-50"
            >
              <option value="">Select…</option>
              {counterpartyAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <button type="submit" disabled={busy} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              Record transaction
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-gray-500">No intercompany transactions yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Between</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                    {t.organization.name} → {t.counterpartyOrganization.name}
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{t.description || '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(t.amount)}</td>
                  <td className="px-4 py-2">
                    {t.eliminated ? (
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-midnight-800 dark:text-gray-300">
                        Eliminated
                      </span>
                    ) : (
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!t.eliminated && t.organizationId === currentOrg?.id && (
                      <button onClick={() => handleEliminate(t.id)} disabled={busy} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
                        Eliminate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function IntercompanyTransactionsPage() {
  return (
    <ProtectedRoute>
      <IntercompanyTransactionsContent />
    </ProtectedRoute>
  )
}
