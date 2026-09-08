import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Period = { id: string; startDate: string; endDate: string; isClosed: boolean }
type ChecklistItem = {
  id: string
  label: string
  status: string
  notes: string | null
  assignedToUserId: string | null
  completedAt: string | null
}

function CloseChecklistContent() {
  const { token, currentOrg } = useAuth()
  const [periods, setPeriods] = useState<Period[]>([])
  const [periodId, setPeriodId] = useState('')
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function loadPeriods() {
    if (!currentOrg) return
    const res = await fetch(`/api/accounting-periods?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
    if (res.ok) {
      const data: Period[] = await res.json()
      setPeriods(data)
      if (data.length > 0) setPeriodId((prev) => prev || data[0].id)
    }
  }

  async function loadItems(pid: string) {
    if (!currentOrg || !pid) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/close-checklist?organizationId=${currentOrg.id}&accountingPeriodId=${pid}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load checklist')
      setItems(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPeriods()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  useEffect(() => {
    if (periodId) loadItems(periodId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId])

  async function handleCreateChecklist() {
    if (!currentOrg || !periodId) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/close-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, accountingPeriodId: periodId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create checklist')
      }
      await loadItems(periodId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleItem(item: ChecklistItem) {
    setBusy(true)
    setError(null)
    try {
      const nextStatus = item.status === 'complete' ? 'pending' : 'complete'
      const res = await fetch(`/api/close-checklist/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not update checklist item')
      }
      await loadItems(periodId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const completeCount = items.filter((i) => i.status === 'complete').length

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Period close checklist</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/accounting/chart-of-accounts" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Chart of accounts
          </Link>
          <Link href="/accounting/reconcile-account" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Reconcile an account
          </Link>
          <Link href="/accounting/fixed-assets" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Fixed assets
          </Link>
          <Link href="/accounting/loans" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Loans
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5 mb-4">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Accounting period</label>
        {periods.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">No accounting periods found for this organization.</p>
        ) : (
          <select
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            className="mt-1 w-full max-w-sm rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {new Date(p.startDate).toLocaleDateString()} – {new Date(p.endDate).toLocaleDateString()}
                {p.isClosed ? ' (closed)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
          <p className="text-sm text-gray-500 mb-3">No checklist created for this period yet.</p>
          <button
            onClick={handleCreateChecklist}
            disabled={busy || !periodId}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            Create default checklist
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 dark:border-midnight-800 text-xs text-gray-500 dark:text-gray-400">
            {completeCount} of {items.length} complete
          </div>
          <ul>
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-100 dark:border-midnight-800 first:border-t-0">
                <input
                  type="checkbox"
                  checked={item.status === 'complete'}
                  onChange={() => toggleItem(item)}
                  disabled={busy}
                />
                <span
                  className={
                    'text-sm flex-1 ' +
                    (item.status === 'complete' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100')
                  }
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function CloseChecklistPage() {
  return (
    <ProtectedRoute>
      <CloseChecklistContent />
    </ProtectedRoute>
  )
}
