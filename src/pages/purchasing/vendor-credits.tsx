import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import PageHeader from '../../components/PageHeader'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Vendor = { id: string; name: string }
type Account = { id: string; code: string; name: string; type: string }
type Bill = { id: string; billNumber: string; total: string; amountPaid: string; vendorId: string }
type VendorCredit = { id: string; creditNumber: string; amount: string; remainingAmount: string; reason: string | null; vendor: { id: string; name: string } }

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function VendorCreditsContent() {
  const { token, currentOrg } = useAuth()
  const [credits, setCredits] = useState<VendorCredit[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ vendorId: '', amount: '', reason: '', expenseAccountId: '' })
  const [submitting, setSubmitting] = useState(false)
  const [applyState, setApplyState] = useState<Record<string, { billId: string; amount: string }>>({})

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [cRes, vRes, aRes, bRes] = await Promise.all([
        fetch(`/api/vendor-credits?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/vendors?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/bills?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!cRes.ok) throw new Error('Could not load vendor credits')
      setCredits(await cRes.json())
      setVendors(vRes.ok ? await vRes.json() : [])
      setAccounts(aRes.ok ? (await aRes.json()).filter((a: Account) => a.type === 'expense') : [])
      setBills(bRes.ok ? (await bRes.json()).map((b: any) => ({ id: b.id, billNumber: b.billNumber, total: b.total, amountPaid: b.amountPaid, vendorId: b.vendor?.id || b.vendorId })) : [])
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

  async function handleApply(creditId: string) {
    const state = applyState[creditId]
    if (!state?.billId || !state?.amount) return setError('Select a bill and amount to apply')
    setError(null)
    try {
      const res = await fetch(`/api/vendor-credits/${creditId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ billId: state.billId, amount: state.amount }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not apply vendor credit')
      }
      setApplyState((s) => ({ ...s, [creditId]: { billId: '', amount: '' } }))
      await load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div>
      <PageHeader
        icon="↩️"
        eyebrow="Purchasing"
        title="Vendor Credits"
        subtitle={currentOrg?.name}
        quickLinks={[{ label: 'Purchase Orders', href: '/purchasing/purchase-orders', icon: '📋' }]}
      />
      <div className="mb-6 flex justify-end">
        <button onClick={() => setShowForm((s) => !s)} className="rounded-xl bg-teal-600 text-white px-3.5 py-2 text-sm font-medium hover:bg-teal-700 transition-colors">
          {showForm ? 'Cancel' : '+ New Vendor Credit'}
        </button>
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
        <div className="space-y-3">
          {credits.map((c) => {
            const vendorBills = bills.filter((b) => b.vendorId === c.vendor.id && Number(b.total) - Number(b.amountPaid) > 0)
            const state = applyState[c.id] || { billId: '', amount: '' }
            return (
              <div key={c.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{c.creditNumber} — {c.vendor.name}</span>
                  <span className="text-gray-500 dark:text-gray-400">{currency(c.remainingAmount)} remaining of {currency(c.amount)}</span>
                </div>
                {c.reason && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{c.reason}</p>}
                {Number(c.remainingAmount) > 0 && vendorBills.length > 0 && (
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Apply to bill</label>
                      <select
                        value={state.billId}
                        onChange={(e) => setApplyState((s) => ({ ...s, [c.id]: { ...state, billId: e.target.value } }))}
                        className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                      >
                        <option value="">Select…</option>
                        {vendorBills.map((b) => <option key={b.id} value={b.id}>{b.billNumber}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Amount</label>
                      <input
                        value={state.amount}
                        onChange={(e) => setApplyState((s) => ({ ...s, [c.id]: { ...state, amount: e.target.value } }))}
                        className="mt-1 w-28 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleApply(c.id)}
                      className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            )
          })}
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
