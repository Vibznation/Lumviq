import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import PageHeader from '../../components/PageHeader'
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
  const [syncing, setSyncing] = useState(false)
  const [revalLoading, setRevalLoading] = useState(false)
  const [revalSummary, setRevalSummary] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
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

  async function handleSyncRates() {
    if (!currentOrg) return
    setSyncing(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/currencies/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, baseCurrency: 'USD' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to sync live rates')
      setMessage(`Synced ${data.syncedCount} currency rates from ${data.provider}.`)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleComputeRevaluation() {
    if (!currentOrg) return
    setRevalLoading(true)
    setError(null)
    try {
      const currentRates: Record<string, number> = {}
      rates.forEach((r) => {
        currentRates[r.quoteCurrency.toUpperCase()] = Number(r.rate)
      })
      const res = await fetch('/api/currencies/revaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, baseCurrency: 'USD', currentRates }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to compute revaluation')
      setRevalSummary(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRevalLoading(false)
    }
  }

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
    <div className="max-w-4xl">
      <PageHeader
        icon="💱"
        eyebrow="Settings"
        title="Currencies & Exchange Rates"
        subtitle={`${currentOrg?.name || ''} — sync live exchange rates, enter manual rates, and compute period-end FX revaluations.`}
      />

      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSyncRates}
            disabled={syncing}
            className="rounded-md bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-1.5 text-xs font-medium shadow-sm transition disabled:opacity-50"
          >
            {syncing ? 'Syncing Rates…' : '🔄 Sync Live FX Rates'}
          </button>
          <button
            type="button"
            onClick={handleComputeRevaluation}
            disabled={revalLoading}
            className="rounded-md bg-white dark:bg-midnight-900 border border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 hover:bg-teal-50 px-3.5 py-1.5 text-xs font-medium transition disabled:opacity-50"
          >
            {revalLoading ? 'Analyzing…' : '📈 Period-End FX Revaluation'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 text-sm text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2">
          {message}
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {revalSummary && (
        <div className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Unrealized FX Gain/Loss Summary</h3>
            <span className={`text-sm font-bold ${revalSummary.netGainMinor >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              Net Unrealized: {revalSummary.netGainMinor >= 0 ? '+' : '-'}${revalSummary.totalUnrealizedGainLoss} USD
            </span>
          </div>
          {revalSummary.items.length === 0 ? (
            <p className="text-xs text-gray-500">No open foreign-currency invoices or bills found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-gray-500">
                  <tr>
                    <th className="px-2 py-1.5">Type / Ref</th>
                    <th className="px-2 py-1.5">Party</th>
                    <th className="px-2 py-1.5 text-right">Foreign Balance</th>
                    <th className="px-2 py-1.5 text-right">Current Rate</th>
                    <th className="px-2 py-1.5 text-right">Base Equivalent</th>
                    <th className="px-2 py-1.5 text-right">Unrealized Gain/(Loss)</th>
                  </tr>
                </thead>
                <tbody>
                  {revalSummary.items.map((it: any) => (
                    <tr key={it.id} className="border-t border-gray-100 dark:border-midnight-800">
                      <td className="px-2 py-1.5 font-medium uppercase">{it.type}: {it.reference}</td>
                      <td className="px-2 py-1.5">{it.partyName}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{it.foreignCurrency} {it.foreignAmount}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{it.currentRate}</td>
                      <td className="px-2 py-1.5 text-right font-mono">${it.currentBaseAmount}</td>
                      <td className={`px-2 py-1.5 text-right font-semibold ${it.isGain ? 'text-emerald-600' : 'text-red-600'}`}>
                        {it.isGain ? '+' : '-'}${it.unrealizedGainLoss}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
