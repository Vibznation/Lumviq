import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

const RESOURCE_TYPES = [
  { key: 'bill-payment', label: 'Bill payment' },
  { key: 'reimbursement', label: 'Reimbursement' },
  { key: 'purchase-order', label: 'Purchase order' },
]

function ApprovalThresholdsContent() {
  const { token, currentOrg } = useAuth()
  const [thresholds, setThresholds] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/settings/approval-thresholds?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load approval thresholds')
      const data = await res.json()
      const asStrings: Record<string, string> = {}
      for (const t of RESOURCE_TYPES) asStrings[t.key] = data[t.key] != null ? String(data[t.key]) : ''
      setThresholds(asStrings)
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const payload: Record<string, number> = {}
      for (const [k, v] of Object.entries(thresholds)) {
        if (v !== '') payload[k] = Number(v)
      }
      const res = await fetch('/api/settings/approval-thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, thresholds: payload }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not save approval thresholds')
      }
      setSaved(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-4">
        <Link href="/settings/organization" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← Back to organization settings</Link>
      </div>
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Approval thresholds</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{currentOrg?.name} — payments above these amounts require approval. Only an owner or admin can change these.</p>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      {saved && <div className="mb-4 text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-3 py-2">Saved.</div>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <form onSubmit={handleSave} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 space-y-3">
          {RESOURCE_TYPES.map((t) => (
            <div key={t.key}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{t.label} threshold ($)</label>
              <input
                value={thresholds[t.key] || ''}
                onChange={(e) => setThresholds((f) => ({ ...f, [t.key]: e.target.value }))}
                placeholder="Use default"
                className="mt-1 w-40 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
              />
            </div>
          ))}
          <button type="submit" disabled={saving} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save thresholds'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function ApprovalThresholdsPage() {
  return (
    <ProtectedRoute>
      <ApprovalThresholdsContent />
    </ProtectedRoute>
  )
}
