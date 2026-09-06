import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ProtectedRoute from '../components/ProtectedRoute'
import { authHeaders, useAuth } from '../lib/auth-context'

type Insight = { type: string; label: string; severity: 'info' | 'warning'; summary: string; basis: any }
type ChatMessage = { question: string; answer: string; basis: any }

function IntelligenceContent() {
  const { token, currentOrg } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'Insights' | 'Chat'>('Insights')
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatError, setChatError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    fetch(`/api/intelligence/insights?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load insights')
        const data = await res.json()
        setInsights(data.insights)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [currentOrg?.id, token])

  useEffect(() => {
    const q = router.query.tab
    if (q === 'Insights' || q === 'Chat') setTab(q)
  }, [router.query.tab])

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !question.trim()) return
    setAsking(true)
    setChatError(null)
    try {
      const res = await fetch('/api/intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, question }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not get an answer')
      }
      const data = await res.json()
      setMessages((m) => [...m, { question, answer: data.answer, basis: data.basis }])
      setQuestion('')
    } catch (err: any) {
      setChatError(err.message)
    } finally {
      setAsking(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Intelligence</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
      </div>

      <div className="mb-6 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-midnight-800 border border-gray-200 dark:border-midnight-700 rounded-md px-3 py-2">
        These insights and chat answers are computed with deterministic, rule-based calculations directly on your
        ledger, invoice and bill data — not by a language model. Nothing here posts entries, moves money, or files
        anything on your behalf. Each answer shows the data and method used so the result is never a mystery.
      </div>

      <div className="mb-6 flex gap-4 border-b border-gray-200 dark:border-midnight-800">
        {(['Insights', 'Chat'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-teal-600 text-teal-700 dark:text-teal-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Insights' && (
      <>
      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div key={insight.type} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${insight.severity === 'warning' ? 'bg-amber-500' : 'bg-teal-500'}`}
                  />
                  <h2 className="font-semibold text-midnight-900 dark:text-white">{insight.label}</h2>
                </div>
                <button
                  onClick={() => setExpanded(expanded === insight.type ? null : insight.type)}
                  className="text-xs text-teal-700 dark:text-teal-400 hover:underline"
                >
                  {expanded === insight.type ? 'Hide basis' : 'Show basis'}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{insight.summary}</p>
              {expanded === insight.type && (
                <pre className="mt-3 text-xs bg-gray-50 dark:bg-midnight-800 border border-gray-200 dark:border-midnight-700 rounded-md p-3 overflow-x-auto text-gray-700 dark:text-gray-300">
                  {JSON.stringify(insight.basis, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {tab === 'Chat' && (
        <div className="max-w-2xl">
          {chatError && (
            <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {chatError}
            </div>
          )}
          <form onSubmit={handleAsk} className="mb-6 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What's my cash balance? What invoices are overdue?"
              className="flex-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
            />
            <button type="submit" disabled={asking} className="rounded-md bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {asking ? 'Asking…' : 'Ask'}
            </button>
          </form>

          {messages.length === 0 ? (
            <p className="text-sm text-gray-500">Ask about cash on hand, overdue invoices, upcoming bills, or recent profit.</p>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">You asked: {m.question}</p>
                  <p className="text-sm text-gray-800 dark:text-gray-100">{m.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function IntelligencePage() {
  return (
    <ProtectedRoute>
      <IntelligenceContent />
    </ProtectedRoute>
  )
}
