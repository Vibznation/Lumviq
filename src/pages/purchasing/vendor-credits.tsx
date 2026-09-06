import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Vendor = { id: string; name: string }
type Account = { id: string; code: string; name: string; type: string }
type VendorCredit = { id: string; creditNumber: string; amount: string; remainingAmount: string; vendor: { name: string } }

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function VendorCreditsContent() {
  const { token, currentOrg } = useAuth()
  const [credits, setCredits] = useState<VendorCredit[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ vendorId: '', amount: '', reason: '', expenseAccountId: '' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [cRes, vRes, aRes] = await Promise.all([
        fetch(`/api/vendor-credits?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/vendors?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!cRes.ok) throw new Error('Could not load vendor credits')
      setCredits(await cRes.json())
      setVendors(vRes.ok ? await vRes.json() : [])
      setAccounts(aRes.ok ? (await aRes.json()).filter((a: Account) => a.type === 'expense') : [])
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
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/vendor-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create vendor credit')
      }
      setForm({ vendorId: '', amount: '', reason: '', expenseAccountId: '' })
      setShowForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Vendor Credits</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/purchasing/purchase-orders" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">Purchase orders →</Link>
          <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
            {showForm ? 'Cancel' : 'New vendor credit'}
          </button>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid gap-3 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Vendor</label>
            <select required value={form.vendorId} onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              <option value="">Select…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Amount</label>
            <input required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Expense account (contra)</label>
            <select required value={form.expenseAccountId} onChange={(e) => setForm((f) => ({ ...f, expenseAccountId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Reason (optional)</label>
            <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save & post to ledger'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : credits.length === 0 ? (
        <p className="text-sm text-gray-500">No vendor credits yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Number</th>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2 text-right">Original</th>
                <th className="px-4 py-2 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {credits.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{c.creditNumber}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{c.vendor?.name}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(c.amount)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(c.remainingAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function VendorCreditsPage() {
  return (
    <ProtectedRoute>
      <VendorCreditsContent />
    </ProtectedRoute>
  )
}
