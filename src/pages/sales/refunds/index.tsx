import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Account = { id: string; code: string; name: string; subtype: string | null }
type Invoice = { id: string; invoiceNumber: string; total: string; amountPaid: string; customer: { name: string } }
type Refund = {
  id: string
  amount: string
  refundDate: string
  reason: string | null
  invoice: { invoiceNumber: string; customer: { name: string } }
  createdAt: string
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function RefundsContent() {
  const { token, currentOrg } = useAuth()
  const [refunds, setRefunds] = useState<Refund[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [bankAccounts, setBankAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    invoiceId: '',
    amount: '',
    refundDate: new Date().toISOString().slice(0, 10),
    reason: '',
    depositAccountId: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoice-refunds?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load refunds')
      setRefunds(await res.json())
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
    if (!currentOrg) return
    fetch(`/api/invoices?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : []))
      .then((inv: Invoice[]) => setInvoices(inv.filter((i) => Number(i.amountPaid) > 0)))
    fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : []))
      .then((accounts: Account[]) => {
        const banks = accounts.filter((a) => a.subtype === 'bank')
        setBankAccounts(banks)
        if (banks.length > 0) setForm((f) => ({ ...f, depositAccountId: banks[0].id }))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    if (!form.invoiceId) return setError('Select an invoice')
    if (!form.depositAccountId) return setError('Select a deposit account the refund is paid from')
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/invoice-refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not record refund')
      }
      setForm((f) => ({ ...f, amount: '', reason: '' }))
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
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Refunds</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sales/invoices" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">Invoices →</Link>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700"
          >
            {showForm ? 'Cancel' : 'New refund'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid gap-3 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Invoice</label>
            <select
              required
              value={form.invoiceId}
              onChange={(e) => setForm((f) => ({ ...f, invoiceId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} — {i.customer.name} (paid {currency(i.amountPaid)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Amount</label>
            <input
              required
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Refund date</label>
            <input
              type="date"
              required
              value={form.refundDate}
              onChange={(e) => setForm((f) => ({ ...f, refundDate: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Refunded from</label>
            <select
              required
              value={form.depositAccountId}
              onChange={(e) => setForm((f) => ({ ...f, depositAccountId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Reason</label>
            <input
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Record refund'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : refunds.length === 0 ? (
        <p className="text-sm text-gray-500">No refunds yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.invoice.invoiceNumber}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.invoice.customer.name}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(r.refundDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function RefundsPage() {
  return (
    <ProtectedRoute>
      <RefundsContent />
    </ProtectedRoute>
  )
}
