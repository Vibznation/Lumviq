import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type TaxRate = { id: string; name: string; rate: string; isDefault: boolean }

function TaxRatesContent() {
  const { token, currentOrg } = useAuth()
  const [rates, setRates] = useState<TaxRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', rate: '', isDefault: false })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tax-rates?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load tax rates')
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
    if (!currentOrg || !form.name || !form.rate) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/tax-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, name: form.name, rate: (Number(form.rate) / 100).toString(), isDefault: form.isDefault }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create tax rate')
      }
      setForm({ name: '', rate: '', isDefault: false })
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Tax rates</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{currentOrg?.name} — used on invoice and bill line items</p>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Rate (%)</label>
          <input required value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} className="mt-1 w-24 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 pb-1.5">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
          Default
        </label>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          {submitting ? 'Saving…' : 'Add rate'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rates.length === 0 ? (
        <p className="text-sm text-gray-500">No tax rates yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2 text-right">Rate</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.name}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{(Number(r.rate) * 100).toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right">{r.isDefault && <span className="text-xs text-teal-700 dark:text-teal-400">Default</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function TaxRatesPage() {
  return (
    <ProtectedRoute>
      <TaxRatesContent />
    </ProtectedRoute>
  )
}
