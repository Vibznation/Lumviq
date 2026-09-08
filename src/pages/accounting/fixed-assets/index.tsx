import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Account = { id: string; code: string; name: string; type: string }
type DepreciationEntry = { id: string; periodDate: string; amount: string }
type FixedAsset = {
  id: string
  name: string
  cost: string
  salvageValue: string
  usefulLifeMonths: number
  acquisitionDate: string
  disposedAt: string | null
  depreciationEntries: DepreciationEntry[]
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const emptyForm = {
  name: '',
  assetAccountId: '',
  depreciationExpenseAccountId: '',
  accumulatedDepreciationAccountId: '',
  acquisitionDate: new Date().toISOString().slice(0, 10),
  cost: '',
  salvageValue: '0',
  usefulLifeMonths: '36',
}

function FixedAssetsContent() {
  const { token, currentOrg } = useAuth()
  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const assetAccounts = accounts.filter((a) => a.type === 'asset')
  const expenseAccounts = accounts.filter((a) => a.type === 'expense')

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [assetsRes, accountsRes] = await Promise.all([
        fetch(`/api/fixed-assets?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!assetsRes.ok) throw new Error('Could not load fixed assets')
      setAssets(await assetsRes.json())
      if (accountsRes.ok) setAccounts(await accountsRes.json())
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
    if (!form.name || !form.assetAccountId || !form.depreciationExpenseAccountId || !form.accumulatedDepreciationAccountId || !form.cost) {
      return setError('Name, accounts and cost are required')
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/fixed-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          ...form,
          cost: Number(form.cost),
          salvageValue: Number(form.salvageValue || 0),
          usefulLifeMonths: Number(form.usefulLifeMonths),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create fixed asset')
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Fixed assets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/accounting/reconcile-account" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Reconcile an account
          </Link>
          <Link href="/accounting/close-checklist" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Close checklist
          </Link>
          <Link href="/accounting/loans" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Loans
          </Link>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700"
          >
            {showForm ? 'Cancel' : 'New fixed asset'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5 mb-6 grid grid-cols-2 gap-3 items-end">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Asset account</label>
            <select
              value={form.assetAccountId}
              onChange={(e) => setForm({ ...form, assetAccountId: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Accumulated depreciation account</label>
            <select
              value={form.accumulatedDepreciationAccountId}
              onChange={(e) => setForm({ ...form, accumulatedDepreciationAccountId: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Depreciation expense account</label>
            <select
              value={form.depreciationExpenseAccountId}
              onChange={(e) => setForm({ ...form, depreciationExpenseAccountId: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Acquisition date</label>
            <input
              type="date"
              value={form.acquisitionDate}
              onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Cost</label>
            <input
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Salvage value</label>
            <input
              value={form.salvageValue}
              onChange={(e) => setForm({ ...form, salvageValue: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Useful life (months)</label>
            <input
              value={form.usefulLifeMonths}
              onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={busy} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              Create fixed asset
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-gray-500">No fixed assets yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-right">Accumulated depreciation</th>
                <th className="px-4 py-2 text-right">Book value</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const accumulated = a.depreciationEntries.reduce((sum, e) => sum + Number(e.amount), 0)
                const bookValue = Number(a.cost) - accumulated
                return (
                  <tr key={a.id} className="border-t border-gray-100 dark:border-midnight-800 hover:bg-gray-50 dark:hover:bg-midnight-800">
                    <td className="px-4 py-2">
                      <Link href={`/accounting/fixed-assets/${a.id}`} className="text-teal-700 dark:text-teal-400 hover:underline">
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(a.cost)}</td>
                    <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(accumulated)}</td>
                    <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(bookValue)}</td>
                    <td className="px-4 py-2">
                      {a.disposedAt ? (
                        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                          Disposed
                        </span>
                      ) : (
                        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function FixedAssetsPage() {
  return (
    <ProtectedRoute>
      <FixedAssetsContent />
    </ProtectedRoute>
  )
}
