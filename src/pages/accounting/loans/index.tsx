import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Account = { id: string; code: string; name: string; type: string; subtype: string | null }
type LoanPayment = { id: string; paymentDate: string; principalPortion: string; interestPortion: string }
type Loan = {
  id: string
  name: string
  principal: string
  interestRatePercent: string
  termMonths: number
  startDate: string
  payments: LoanPayment[]
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const emptyForm = {
  name: '',
  liabilityAccountId: '',
  interestExpenseAccountId: '',
  disbursementAccountId: '',
  principal: '',
  interestRatePercent: '',
  termMonths: '36',
  startDate: new Date().toISOString().slice(0, 10),
}

function LoansContent() {
  const { token, currentOrg } = useAuth()
  const [loans, setLoans] = useState<Loan[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const liabilityAccounts = accounts.filter((a) => a.type === 'liability')
  const expenseAccounts = accounts.filter((a) => a.type === 'expense')
  const bankAccounts = accounts.filter((a) => a.subtype === 'bank')

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [loansRes, accountsRes] = await Promise.all([
        fetch(`/api/loans?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!loansRes.ok) throw new Error('Could not load loans')
      setLoans(await loansRes.json())
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
    if (!form.name || !form.liabilityAccountId || !form.interestExpenseAccountId || !form.disbursementAccountId || !form.principal || !form.interestRatePercent) {
      return setError('All fields are required')
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          ...form,
          principal: Number(form.principal),
          interestRatePercent: Number(form.interestRatePercent),
          termMonths: Number(form.termMonths),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create loan')
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
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Loans</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/accounting/reconcile-account" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Reconcile an account
          </Link>
          <Link href="/accounting/close-checklist" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Close checklist
          </Link>
          <Link href="/accounting/fixed-assets" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Fixed assets
          </Link>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700"
          >
            {showForm ? 'Cancel' : 'New loan'}
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Liability account</label>
            <select
              value={form.liabilityAccountId}
              onChange={(e) => setForm({ ...form, liabilityAccountId: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {liabilityAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Interest expense account</label>
            <select
              value={form.interestExpenseAccountId}
              onChange={(e) => setForm({ ...form, interestExpenseAccountId: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Disbursement / payment account</label>
            <select
              value={form.disbursementAccountId}
              onChange={(e) => setForm({ ...form, disbursementAccountId: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {(bankAccounts.length > 0 ? bankAccounts : accounts.filter((a) => a.type === 'asset')).map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Start date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Principal</label>
            <input
              value={form.principal}
              onChange={(e) => setForm({ ...form, principal: e.target.value })}
              placeholder="0.00"
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Interest rate (% annual)</label>
            <input
              value={form.interestRatePercent}
              onChange={(e) => setForm({ ...form, interestRatePercent: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Term (months)</label>
            <input
              value={form.termMonths}
              onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={busy} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              Create loan
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : loans.length === 0 ? (
        <p className="text-sm text-gray-500">No loans yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2 text-right">Principal</th>
                <th className="px-4 py-2 text-right">Rate</th>
                <th className="px-4 py-2 text-right">Term</th>
                <th className="px-4 py-2 text-right">Payments made</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.id} className="border-t border-gray-100 dark:border-midnight-800 hover:bg-gray-50 dark:hover:bg-midnight-800">
                  <td className="px-4 py-2">
                    <Link href={`/accounting/loans/${l.id}`} className="text-teal-700 dark:text-teal-400 hover:underline">
                      {l.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(l.principal)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{Number(l.interestRatePercent).toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{l.termMonths} mo</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{l.payments.length} / {l.termMonths}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function LoansPage() {
  return (
    <ProtectedRoute>
      <LoansContent />
    </ProtectedRoute>
  )
}
