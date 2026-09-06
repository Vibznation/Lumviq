import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../components/ProtectedRoute'
import { authHeaders, useAuth } from '../lib/auth-context'

type Insight = { type: string; label: string; severity: 'info' | 'warning'; summary: string; basis: any }

function IntelligenceContent() {
  const { token, currentOrg } = useAuth()
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Intelligence</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
      </div>

      <div className="mb-6 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-midnight-800 border border-gray-200 dark:border-midnight-700 rounded-md px-3 py-2">
        These insights are computed with deterministic, rule-based calculations directly on your ledger, invoice
        and bill data — not by a language model. Nothing here posts entries, moves money, or files anything on your
        behalf. Each insight shows the data and method used so the result is never a mystery.
      </div>

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
