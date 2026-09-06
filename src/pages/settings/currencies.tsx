import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type ExchangeRate = { id: string; baseCurrency: string; quoteCurrency: string; rate: string; asOfDate: string }

/**
 * Manually entered exchange rates for multi-currency conversion/display
 * (see src/lib/currency.ts). There is no live-rate provider configured —
 * rates must be entered here. Posted ledger amounts always remain in the
 * currency they were recorded in; rates never retroactively change them.
 */
function CurrenciesContent() {
  const { token, currentOrg } = useAuth()
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ baseCurrency: 'USD', quoteCurrency: '', rate: '', asOfDate: '' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/currency/exchange-rates?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load exchange rates')
      setRates(await res.json())
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
    if (!currentOrg || !form.quoteCurrency || !form.rate || !form.asOfDate) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/currency/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not add rate')
      setForm({ baseCurrency: 'USD', quoteCurrency: '', rate: '', asOfDate: '' })
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Currencies &amp; exchange rates</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{currentOrg?.name} — manually entered rates for conversion and display only</p>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Base</label>
          <input required value={form.baseCurrency} onChange={(e) => setForm((f) => ({ ...f, baseCurrency: e.target.value.toUpperCase() }))} maxLength={3} className="mt-1 w-16 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm uppercase" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Quote</label>
          <input required value={form.quoteCurrency} onChange={(e) => setForm((f) => ({ ...f, quoteCurrency: e.target.value.toUpperCase() }))} maxLength={3} className="mt-1 w-16 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm uppercase" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Rate</label>
          <input required value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} className="mt-1 w-28 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">As of</label>
          <input required type="date" value={form.asOfDate} onChange={(e) => setForm((f) => ({ ...f, asOfDate: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          Add rate
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rates.length === 0 ? (
        <p className="text-sm text-gray-500">No exchange rates yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="px-4 py-2">Pair</th><th className="px-4 py-2 text-right">Rate</th><th className="px-4 py-2">As of</th></tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.baseCurrency}/{r.quoteCurrency}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{Number(r.rate).toFixed(6)}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{new Date(r.asOfDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function CurrenciesPage() {
  return (
    <ProtectedRoute>
      <CurrenciesContent />
    </ProtectedRoute>
  )
}
