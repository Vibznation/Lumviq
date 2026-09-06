import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Account = { id: string; code: string; name: string; type: string }
type BudgetRow = {
  accountId: string
  accountCode: string
  accountName: string
  periodMonth: number
  periodYear: number
  budgeted: number
  actual: number
  variance: number
  variancePct: number | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function currency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function PlanningContent() {
  const { token, currentOrg } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ accountId: '', periodMonth: '1', amount: '' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [aRes, bRes] = await Promise.all([
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/reports/budget-vs-actual?organizationId=${currentOrg.id}&periodYear=${year}`, { headers: authHeaders(token) }),
      ])
      const accs = aRes.ok ? await aRes.json() : []
      setAccounts(accs.filter((a: Account) => a.type === 'income' || a.type === 'expense'))
      if (!bRes.ok) throw new Error('Could not load budgets')
      const data = await bRes.json()
      setRows(data.rows)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, year])

  async function handleSetBudget(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !form.accountId || !form.amount) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          accountId: form.accountId,
          periodMonth: Number(form.periodMonth),
          periodYear: year,
          amount: form.amount,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not save budget')
      }
      setForm((f) => ({ ...f, amount: '' }))
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0)
  const totalActual = rows.reduce((s, r) => s + r.actual, 0)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Budgeting & Planning</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name} — budget vs actual by month</p>
        </div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSetBudget} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid grid-cols-4 gap-3 max-w-2xl items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Account</label>
          <select value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
            <option value="">--</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Month</label>
          <select value={form.periodMonth} onChange={(e) => setForm((f) => ({ ...f, periodMonth: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Budgeted amount</label>
          <input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          {submitting ? 'Saving…' : 'Set budget'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No budgets set for {year} yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2">Month</th>
                <th className="px-4 py-2 text-right">Budgeted</th>
                <th className="px-4 py-2 text-right">Actual</th>
                <th className="px-4 py-2 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.accountId}-${r.periodMonth}`} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.accountCode} {r.accountName}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{MONTHS[r.periodMonth - 1]} {r.periodYear}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(r.budgeted)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(r.actual)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${r.variance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {currency(r.variance)}
                    {r.variancePct != null && ` (${r.variancePct.toFixed(0)}%)`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-midnight-700 font-semibold">
                <td className="px-4 py-2 text-midnight-900 dark:text-white" colSpan={2}>Total</td>
                <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(totalBudgeted)}</td>
                <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(totalActual)}</td>
                <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(totalActual - totalBudgeted)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default function PlanningPage() {
  return (
    <ProtectedRoute>
      <PlanningContent />
    </ProtectedRoute>
  )
}
