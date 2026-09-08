import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type JournalLine = {
  id: string
  amount: string
  isDebit: boolean
  description: string | null
  clearedAt: string | null
  journalEntry: { id: string; description: string | null; postedAt: string | null }
}

type Reconciliation = {
  id: string
  accountId: string
  periodEndDate: string
  statementBalance: string
  glBalance: string
  status: string
  completedAt: string | null
  account: { code: string; name: string }
  clearedLines: JournalLine[]
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function ReconciliationDetailContent() {
  const router = useRouter()
  const { id } = router.query
  const { token, currentOrg } = useAuth()
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null)
  const [unclearedLines, setUnclearedLines] = useState<JournalLine[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!id) return
    const res = await fetch(`/api/account-reconciliations/${id}`, { headers: authHeaders(token) })
    if (res.ok) {
      const data: Reconciliation = await res.json()
      setReconciliation(data)
      const unclearedRes = await fetch(
        `/api/account-reconciliations?organizationId=${currentOrg?.id}&uncleared=1&accountId=${data.accountId}&asOfDate=${data.periodEndDate}`,
        { headers: authHeaders(token) }
      )
      if (unclearedRes.ok) setUnclearedLines(await unclearedRes.json())
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentOrg?.id])

  function toggle(lineId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })
  }

  async function handleClear() {
    if (!reconciliation || selected.size === 0) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/account-reconciliations/${reconciliation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ action: 'clear', journalLineIds: Array.from(selected) }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not clear lines')
      }
      setSelected(new Set())
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleUnclear(lineId: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/account-reconciliations/${reconciliation!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ action: 'unclear', journalLineIds: [lineId] }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not unclear line')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleComplete() {
    if (!reconciliation) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/account-reconciliations/${reconciliation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ action: 'complete' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not complete reconciliation')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!reconciliation) return <p className="text-sm text-gray-500">Loading…</p>

  const clearedTotal = reconciliation.clearedLines.reduce((sum, l) => sum + Number(l.amount) * (l.isDebit ? 1 : -1), 0)
  const difference = clearedTotal - Number(reconciliation.statementBalance)

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">
            {reconciliation.account.code} {reconciliation.account.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Period ending {new Date(reconciliation.periodEndDate).toLocaleDateString()}
          </p>
        </div>
        <Link href="/accounting/reconcile-account" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
          Back to reconciliations
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5 mb-4">
        <div className="grid grid-cols-3 gap-3 text-sm mb-4">
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Statement balance</span>
            <span className="font-semibold text-midnight-900 dark:text-white">{currency(reconciliation.statementBalance)}</span>
          </div>
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Cleared total</span>
            <span className="font-semibold text-midnight-900 dark:text-white">{currency(clearedTotal)}</span>
          </div>
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Difference</span>
            <span className={'font-semibold ' + (Math.abs(difference) > 0.01 ? 'text-red-600' : 'text-green-600')}>
              {currency(difference)}
            </span>
          </div>
        </div>
        {reconciliation.status === 'completed' ? (
          <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
            Completed {reconciliation.completedAt ? new Date(reconciliation.completedAt).toLocaleDateString() : ''}
          </span>
        ) : (
          <button
            onClick={handleComplete}
            disabled={busy}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            Complete reconciliation
          </button>
        )}
      </div>

      {reconciliation.status !== 'completed' && (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Uncleared transactions</h2>
            <button
              onClick={handleClear}
              disabled={busy || selected.size === 0}
              className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              Clear selected ({selected.size})
            </button>
          </div>
          {unclearedLines.length === 0 ? (
            <p className="text-sm text-gray-500">No uncleared transactions as of this period end.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-1 w-8"></th>
                  <th className="py-1">Date</th>
                  <th className="py-1">Description</th>
                  <th className="py-1 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {unclearedLines.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100 dark:border-midnight-800">
                    <td className="py-1.5">
                      <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
                    </td>
                    <td className="py-1.5 text-gray-500 dark:text-gray-400">
                      {l.journalEntry.postedAt ? new Date(l.journalEntry.postedAt).toLocaleDateString() : ''}
                    </td>
                    <td className="py-1.5 text-gray-900 dark:text-gray-100">{l.description || l.journalEntry.description || '—'}</td>
                    <td className="py-1.5 text-right text-gray-900 dark:text-gray-100">
                      {l.isDebit ? currency(l.amount) : `(${currency(l.amount)})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {reconciliation.clearedLines.length > 0 && (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cleared transactions</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="py-1">Date</th>
                <th className="py-1">Description</th>
                <th className="py-1 text-right">Amount</th>
                {reconciliation.status !== 'completed' && <th className="py-1"></th>}
              </tr>
            </thead>
            <tbody>
              {reconciliation.clearedLines.map((l) => (
                <tr key={l.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="py-1.5 text-gray-500 dark:text-gray-400">
                    {l.journalEntry.postedAt ? new Date(l.journalEntry.postedAt).toLocaleDateString() : ''}
                  </td>
                  <td className="py-1.5 text-gray-900 dark:text-gray-100">{l.description || l.journalEntry.description || '—'}</td>
                  <td className="py-1.5 text-right text-gray-900 dark:text-gray-100">
                    {l.isDebit ? currency(l.amount) : `(${currency(l.amount)})`}
                  </td>
                  {reconciliation.status !== 'completed' && (
                    <td className="py-1.5 text-right">
                      <button onClick={() => handleUnclear(l.id)} disabled={busy} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
                        Unclear
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ReconciliationDetailPage() {
  return (
    <ProtectedRoute>
      <ReconciliationDetailContent />
    </ProtectedRoute>
  )
}
