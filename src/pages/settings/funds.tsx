import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Fund = { id: string; name: string; type: string; description: string | null; grants: Grant[] }
type Grant = { id: string; name: string; grantorName: string; totalAwarded: string; amountSpent: string; status: string }

/**
 * Nonprofit fund accounting: funds group restricted/unrestricted money and
 * grants track award/spend against a fund. This is informational tracking
 * only — creating journal entries doesn't yet require selecting a fund,
 * and there's no dedicated statement-of-activities-by-fund report yet.
 * See docs/known-limitations.md.
 */
function FundsContent() {
  const { token, currentOrg } = useAuth()
  const [funds, setFunds] = useState<Fund[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fundForm, setFundForm] = useState({ name: '', type: 'unrestricted', description: '' })
  const [grantForm, setGrantForm] = useState({ fundId: '', name: '', grantorName: '', totalAwarded: '', startDate: '' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/nonprofit/funds?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load funds')
      setFunds(await res.json())
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

  async function createFund(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !fundForm.name) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/nonprofit/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...fundForm }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not create fund')
      setFundForm({ name: '', type: 'unrestricted', description: '' })
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function createGrant(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !grantForm.name || !grantForm.grantorName || !grantForm.totalAwarded || !grantForm.startDate) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/nonprofit/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...grantForm, fundId: grantForm.fundId || null }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not create grant')
      setGrantForm({ fundId: '', name: '', grantorName: '', totalAwarded: '', startDate: '' })
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Funds &amp; grants</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{currentOrg?.name} — nonprofit fund accounting</p>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={createFund} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Fund name</label>
          <input required value={fundForm.name} onChange={(e) => setFundForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Type</label>
          <select value={fundForm.type} onChange={(e) => setFundForm((f) => ({ ...f, type: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
            <option value="unrestricted">Unrestricted</option>
            <option value="restricted">Restricted</option>
          </select>
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          Add fund
        </button>
      </form>

      <form onSubmit={createGrant} className="mb-8 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Fund</label>
          <select value={grantForm.fundId} onChange={(e) => setGrantForm((f) => ({ ...f, fundId: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
            <option value="">None</option>
            {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Grant name</label>
          <input required value={grantForm.name} onChange={(e) => setGrantForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Grantor</label>
          <input required value={grantForm.grantorName} onChange={(e) => setGrantForm((f) => ({ ...f, grantorName: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Total awarded</label>
          <input required value={grantForm.totalAwarded} onChange={(e) => setGrantForm((f) => ({ ...f, totalAwarded: e.target.value }))} className="mt-1 w-28 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Start date</label>
          <input required type="date" value={grantForm.startDate} onChange={(e) => setGrantForm((f) => ({ ...f, startDate: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          Add grant
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : funds.length === 0 ? (
        <p className="text-sm text-gray-500">No funds yet.</p>
      ) : (
        <div className="space-y-4">
          {funds.map((f) => (
            <div key={f.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{f.name}</h3>
                <span className="text-xs text-gray-500 capitalize">{f.type}</span>
              </div>
              {f.grants.length === 0 ? (
                <p className="text-xs text-gray-500">No grants linked to this fund.</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {f.grants.map((g) => (
                    <li key={g.id} className="flex justify-between text-gray-700 dark:text-gray-300">
                      <span>{g.name} — {g.grantorName}</span>
                      <span>{Number(g.amountSpent).toFixed(2)} / {Number(g.totalAwarded).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FundsPage() {
  return (
    <ProtectedRoute>
      <FundsContent />
    </ProtectedRoute>
  )
}
