import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ReconcileReview from '../../../components/ReconcileReview'

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

export default function SessionPage() {
  const router = useRouter()
  const { id } = router.query
  const [bankTx, setBankTx] = useState<any[]>([])
  const [journalLines, setJournalLines] = useState<any[]>([])
  const [status, setStatus] = useState('')
  const [showReview, setShowReview] = useState(false)
  const [currentSuggestions, setCurrentSuggestions] = useState<any>({})

  useEffect(() => { if (id) load() }, [id])

  async function load() {
    const res1 = await fetch(`/api/banking/transactions?sessionId=${id}`)
    const tx = await readJsonResponse<any[]>(res1, [])
    setBankTx(tx)

    const organizationId = (window as any).ORG_ID || ''
    const res2 = await fetch(`/api/journal/lines?organizationId=${organizationId}`)
    const jl = await readJsonResponse<any[]>(res2, [])
    setJournalLines(jl)
  }

  async function match(txId: string, lineId: string) {
    const res = await fetch('/api/banking/reconcile/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
          headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`/api/banking/reconcile/suggestions?sessionId=${id}`)
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id })
    })

    if (res.ok) setStatus('Session closed')
    else setStatus('Failed to close')
  }

  return (
    <>
      {showReview && <ReconcileReview suggestions={currentSuggestions} onApply={applyMappings} onClose={() => setShowReview(false)} />}
      {!showReview && (
        <div style={{ padding: 20 }}>
          <h1>Reconciliation Session {id}</h1>
          <div style={{ marginBottom: 10 }}>{status}</div>
          <h2>Bank transactions</h2>
          <div style={{ marginBottom: 10 }}>
            <button onClick={autoMatch}>Auto-match suggestions</button>
            <button style={{ marginLeft: 8 }} onClick={getSuggestions}>Get Suggestions</button>
            <button style={{ marginLeft: 8 }} onClick={openReview}>Review Suggestions</button>
            <button style={{ marginLeft: 8 }} onClick={applyAllSuggestions}>Apply All Suggestions</button>
          </div>

          <ul>
            {bankTx.map(tx => (
              <li key={tx.id} style={{ marginBottom: 12 }}>
                <div>{tx.transactionDate} {tx.amount} {tx.description} {tx.isCleared ? '(cleared)' : ''}</div>
                <div style={{ marginTop: 6 }}>
                  Match to: <select id={`sel-${tx.id}`}>
                    <option value="">--select--</option>
                    {journalLines.map(j => <option key={j.id} value={j.id}>{j.description || j.journalEntryDescription} {j.amount}</option>)}
                  </select>
                  <button style={{ marginLeft: 8 }} onClick={() => {
                    const sel = (document.getElementById(`sel-${tx.id}`) as HTMLSelectElement).value
                    if (sel) match(tx.id, sel)
                  }}>Match</button>

                  {tx.suggestions && tx.suggestions.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      Suggestions:
                      <ul>
                        {tx.suggestions.map((s: any) => (
                          <li key={s.journalLineId}>
                            {s.description} {s.amount} — confidence: {Math.round((s.confidence || 0) * 100)}%
                            <button style={{ marginLeft: 8 }} onClick={() => match(tx.id, s.journalLineId)}>Apply</button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <h2>Journal lines</h2>
          <ul>
            {journalLines.map(j => <li key={j.id}>{j.journalEntryDescription} — {j.description} — {j.amount}</li>)}
          </ul>

          <div style={{ marginTop: 20 }}>
            <button onClick={finalize}>Finalize Session</button>
          </div>
        </div>
      )}
    </>
  )
}
