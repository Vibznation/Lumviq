import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ReconcileReview from '../../../components/ReconcileReview'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

async function readJsonResponse<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback
  const text = await res.text()
  if (!text) return fallback

  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

function SessionContent() {
  const router = useRouter()
  const { id } = router.query
  const { token, currentOrg } = useAuth()
  const [bankTx, setBankTx] = useState<any[]>([])
  const [journalLines, setJournalLines] = useState<any[]>([])
  const [status, setStatus] = useState('')
  const [showReview, setShowReview] = useState(false)
  const [currentSuggestions, setCurrentSuggestions] = useState<any>({})

  useEffect(() => { if (id && currentOrg) load() }, [id, currentOrg?.id])

  async function load() {
    const res1 = await fetch(`/api/banking/transactions?sessionId=${id}`, { headers: authHeaders(token) })
    const tx = await readJsonResponse<any[]>(res1, [])
    setBankTx(tx)

    const res2 = await fetch(`/api/journal/lines?organizationId=${currentOrg?.id}`, { headers: authHeaders(token) })
    const jl = await readJsonResponse<any[]>(res2, [])
    setJournalLines(jl)
  }

  async function match(txId: string, lineId: string) {
    const res = await fetch('/api/banking/reconcile/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ sessionId: id, bankTransactionId: txId, journalLineId: lineId })
    })

    if (res.ok) {
      setStatus('Matched')
      load()
    } else {
      setStatus('Match failed')
    }
  }

  async function autoMatch() {
    setStatus('Running auto-match...')
    const promises: Promise<any>[] = []

    for (const tx of bankTx) {
      if (tx.isCleared) continue
      const candidates = journalLines.filter(j => {
        try {
          return parseFloat(j.amount) === parseFloat(tx.amount.toString())
        } catch {
          return false
        }
      })

      if (candidates.length === 1) {
        promises.push(fetch('/api/banking/reconcile/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
          body: JSON.stringify({ sessionId: id, bankTransactionId: tx.id, journalLineId: candidates[0].id })
        }))
      }
    }

    await Promise.all(promises)
    setStatus('Auto-match complete')
    load()
  }

  async function getSuggestions() {
    setStatus('Fetching suggestions...')
    const res = await fetch(`/api/banking/reconcile/suggestions?sessionId=${id}`, { headers: authHeaders(token) })
    if (!res.ok) {
      setStatus('Failed to fetch suggestions')
      return
    }

    const json = await readJsonResponse<{ suggestions?: Record<string, any[]> }>(res, { suggestions: {} })
    const map = json.suggestions || {}
    setBankTx(prev => prev.map(tx => ({ ...tx, suggestions: map[tx.id] || [] })))
    setCurrentSuggestions(map)
    setStatus('Suggestions ready')
  }

  async function openReview() {
    if (!currentSuggestions || Object.keys(currentSuggestions).length === 0) await getSuggestions()
    setShowReview(true)
  }

  async function applyMappings(mappings: any[]) {
    setStatus('Applying selected mappings...')
    const res = await fetch('/api/banking/reconcile/apply-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ sessionId: id, mappings })
    })

    if (res.ok) {
      const j = await readJsonResponse<{ appliedCount?: number }>(res, { appliedCount: 0 })
      setStatus('Applied ' + (j.appliedCount || 0) + ' mappings')
      load()
    } else {
      setStatus('Apply failed')
    }
  }

  async function applyAllSuggestions() {
    setStatus('Applying suggestions...')
    const res = await fetch('/api/banking/reconcile/apply-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ sessionId: id, strategy: 'auto' })
    })

    if (res.ok) {
      const j = await readJsonResponse<{ appliedCount?: number }>(res, { appliedCount: 0 })
      setStatus('Applied ' + (j.appliedCount || 0) + ' suggestions')
      load()
    } else {
      setStatus('Apply failed')
    }
  }

  async function finalize() {
    const res = await fetch('/api/banking/reconcile/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ sessionId: id })
    })

    if (res.ok) setStatus('Session closed')
    else setStatus('Failed to close')
  }

  return (
    <>
      {showReview && <ReconcileReview suggestions={currentSuggestions} onApply={applyMappings} onClose={() => setShowReview(false)} />}
      {!showReview && (
        <div className="max-w-3xl">
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Reconciliation Session</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{status}</p>

          <div className="mb-4 flex flex-wrap gap-2">
            <button onClick={autoMatch} className="rounded-md border border-gray-300 dark:border-midnight-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800">Auto-match</button>
            <button onClick={getSuggestions} className="rounded-md border border-gray-300 dark:border-midnight-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800">Get suggestions</button>
            <button onClick={openReview} className="rounded-md border border-gray-300 dark:border-midnight-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800">Review suggestions</button>
            <button onClick={applyAllSuggestions} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">Apply all suggestions</button>
          </div>

          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bank transactions</h2>
          <ul className="space-y-3 mb-6">
            {bankTx.map(tx => (
              <li key={tx.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-md p-3 text-sm">
                <div className="text-gray-900 dark:text-gray-100">
                  {tx.transactionDate} &middot; {tx.amount} &middot; {tx.description} {tx.isCleared ? <span className="text-green-600">(cleared)</span> : null}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <select id={`sel-${tx.id}`} className="rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1 text-sm">
                    <option value="">--select--</option>
                    {journalLines.map(j => <option key={j.id} value={j.id}>{j.description || j.journalEntryDescription} {j.amount}</option>)}
                  </select>
                  <button
                    onClick={() => {
                      const sel = (document.getElementById(`sel-${tx.id}`) as HTMLSelectElement).value
                      if (sel) match(tx.id, sel)
                    }}
                    className="rounded-md border border-gray-300 dark:border-midnight-700 px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-midnight-800"
                  >
                    Match
                  </button>
                </div>

                {tx.suggestions && tx.suggestions.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Suggestions:
                    <ul className="mt-1 space-y-1">
                      {tx.suggestions.map((s: any) => (
                        <li key={s.journalLineId} className="flex items-center gap-2">
                          <span>{s.description} {s.amount} &middot; confidence {Math.round((s.confidence || 0) * 100)}%</span>
                          <button onClick={() => match(tx.id, s.journalLineId)} className="text-teal-700 dark:text-teal-400 hover:underline">Apply</button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Journal lines</h2>
          <ul className="text-sm text-gray-500 dark:text-gray-400 mb-6 space-y-1">
            {journalLines.map(j => <li key={j.id}>{j.journalEntryDescription} — {j.description} — {j.amount}</li>)}
          </ul>

          <button onClick={finalize} className="rounded-md bg-midnight-700 text-white px-3 py-1.5 text-sm font-medium hover:bg-midnight-800">
            Finalize session
          </button>
        </div>
      )}
    </>
  )
}

export default function SessionPage() {
  return (
    <ProtectedRoute>
      <SessionContent />
    </ProtectedRoute>
  )
}
