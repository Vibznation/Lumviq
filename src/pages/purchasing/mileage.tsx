import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

const DEFAULT_RATE = '0.67'

type MileageLog = {
  id: string
  date: string
  startLocation: string
  endLocation: string
  purpose: string | null
  miles: string
  ratePerMile: string
  amount: string
}

/**
 * Mileage tracking (Lumviq Start and higher). Logs business-travel
 * mileage for tax-deduction / reimbursement purposes; Lumviq does not
 * calculate tax deductions automatically (see docs/known-limitations.md).
 */
function MileageContent() {
  const { token, currentOrg } = useAuth()
  const [logs, setLogs] = useState<MileageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    startLocation: '',
    endLocation: '',
    purpose: '',
    miles: '',
    ratePerMile: DEFAULT_RATE,
  })

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/mileage?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load mileage logs')
      setLogs(await res.json())
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
    if (!currentOrg || !form.startLocation || !form.endLocation || !form.miles) return
    setSubmitting(true)
    setError(null)
    setUpgradeMessage(null)
    try {
      const res = await fetch('/api/mileage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 403 && body.upgradeMessage) setUpgradeMessage(body.upgradeMessage)
        throw new Error(body.error || 'Could not add mileage log')
      }
      setForm((f) => ({ ...f, startLocation: '', endLocation: '', purpose: '', miles: '' }))
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const totalMiles = logs.reduce((sum, l) => sum + Number(l.miles), 0)
  const totalAmount = logs.reduce((sum, l) => sum + Number(l.amount), 0)

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Mileage tracking</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {currentOrg?.name} — log business travel for tax-deduction or reimbursement purposes.
      </p>

      {upgradeMessage && (
        <div className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {upgradeMessage}
        </div>
      )}
      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Date</label>
          <input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">From</label>
          <input required value={form.startLocation} onChange={(e) => setForm((f) => ({ ...f, startLocation: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">To</label>
          <input required value={form.endLocation} onChange={(e) => setForm((f) => ({ ...f, endLocation: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Purpose</label>
          <input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Miles</label>
          <input type="number" step="0.1" min="0" required value={form.miles} onChange={(e) => setForm((f) => ({ ...f, miles: e.target.value }))} className="mt-1 w-24 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Rate/mile ($)</label>
          <input type="number" step="0.001" min="0" required value={form.ratePerMile} onChange={(e) => setForm((f) => ({ ...f, ratePerMile: e.target.value }))} className="mt-1 w-24 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500">No mileage logged yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">From → To</th>
                <th className="px-4 py-2">Purpose</th>
                <th className="px-4 py-2 text-right">Miles</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{new Date(l.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{l.startLocation} → {l.endLocation}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{l.purpose || '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{Number(l.miles).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">${Number(l.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-midnight-700 font-medium">
                <td className="px-4 py-2" colSpan={3}>Total</td>
                <td className="px-4 py-2 text-right">{totalMiles.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">${totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default function MileagePage() {
  return (
    <ProtectedRoute>
      <MileageContent />
    </ProtectedRoute>
  )
}
