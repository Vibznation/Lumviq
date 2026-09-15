import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Customer = { id: string; name: string }
type Account = { id: string; code: string; name: string; type: string }
type Invoice = { id: string; invoiceNumber: string; total: string; amountPaid: string; customerId: string }
type CreditNote = {
  id: string
  creditNumber: string
  amount: string
  remainingAmount: string
  reason: string | null
  customer: { id: string; name: string }
  createdAt: string
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function CreditNotesContent() {
  const { token, currentOrg } = useAuth()
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [incomeAccounts, setIncomeAccounts] = useState<Account[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ customerId: '', amount: '', reason: '', incomeAccountId: '' })
  const [submitting, setSubmitting] = useState(false)
  const [applyState, setApplyState] = useState<Record<string, { invoiceId: string; amount: string }>>({})

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/credit-notes?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load credit notes')
      setCreditNotes(await res.json())
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
    fetch(`/api/customers?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : []))
      .then((c: Customer[]) => {
        setCustomers(c)
        if (c.length > 0) setForm((f) => ({ ...f, customerId: c[0].id }))
      })
    fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : []))
      .then((accounts: Account[]) => setIncomeAccounts(accounts.filter((a) => a.type === 'income')))
    fetch(`/api/invoices?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : []))
      .then((inv: any[]) => setInvoices(inv.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, total: i.total, amountPaid: i.amountPaid, customerId: i.customer?.id || i.customerId }))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create credit note')
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

  async function handleApply(creditNoteId: string) {
    const state = applyState[creditNoteId]
    if (!state?.invoiceId || !state?.amount) return setError('Select an invoice and amount to apply')
    setError(null)
    try {
      const res = await fetch(`/api/credit-notes/${creditNoteId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ invoiceId: state.invoiceId, amount: state.amount }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not apply credit note')
      }
      setApplyState((s) => ({ ...s, [creditNoteId]: { invoiceId: '', amount: '' } }))
      await load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Credit notes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sales/invoices" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">Invoices →</Link>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700"
          >
            {showForm ? 'Cancel' : 'New credit note'}
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Customer</label>
            <select
              required
              value={form.customerId}
              onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Income account (contra-revenue)</label>
            <select
              required
              value={form.incomeAccountId}
              onChange={(e) => setForm((f) => ({ ...f, incomeAccountId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {incomeAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
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
            {submitting ? 'Saving…' : 'Save credit note'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : creditNotes.length === 0 ? (
        <p className="text-sm text-gray-500">No credit notes yet.</p>
      ) : (
        <div className="space-y-3">
          {creditNotes.map((cn) => {
            const custInvoices = invoices.filter((i) => i.customerId === cn.customer.id && Number(i.total) - Number(i.amountPaid) > 0)
            const state = applyState[cn.id] || { invoiceId: '', amount: '' }
            return (
              <div key={cn.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{cn.creditNumber} — {cn.customer.name}</span>
                  <span className="text-gray-500 dark:text-gray-400">{currency(cn.remainingAmount)} remaining of {currency(cn.amount)}</span>
                </div>
                {cn.reason && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{cn.reason}</p>}
                {Number(cn.remainingAmount) > 0 && custInvoices.length > 0 && (
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Apply to invoice</label>
                      <select
                        value={state.invoiceId}
                        onChange={(e) => setApplyState((s) => ({ ...s, [cn.id]: { ...state, invoiceId: e.target.value } }))}
                        className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                      >
                        <option value="">Select…</option>
                        {custInvoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNumber}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Amount</label>
                      <input
                        value={state.amount}
                        onChange={(e) => setApplyState((s) => ({ ...s, [cn.id]: { ...state, amount: e.target.value } }))}
                        className="mt-1 w-28 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleApply(cn.id)}
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

export default function CreditNotesPage() {
  return (
    <ProtectedRoute>
      <CreditNotesContent />
    </ProtectedRoute>
  )
}
