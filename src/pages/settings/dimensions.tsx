import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type DimensionValue = { id: string; name: string }
type Dimension = { id: string; name: string; values: DimensionValue[] }

/**
 * Dimensions (a.k.a. classes/departments/locations/programs) let manual
 * journal entry lines be tagged with an extra reporting axis. Only manual
 * journal entries support tagging today — invoice, bill and payroll lines
 * are not yet taggable. See docs/known-limitations.md.
 */
function DimensionsContent() {
  const { token, currentOrg } = useAuth()
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newDimensionName, setNewDimensionName] = useState('')
  const [newValueName, setNewValueName] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dimensions?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load dimensions')
      setDimensions(await res.json())
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

  async function createDimension(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !newDimensionName) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/dimensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, name: newDimensionName }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not create dimension')
      setNewDimensionName('')
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function createValue(dimensionId: string) {
    const name = newValueName[dimensionId]
    if (!name) return
    setError(null)
    try {
      const res = await fetch(`/api/dimensions/${dimensionId}/values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not add value')
      setNewValueName((v) => ({ ...v, [dimensionId]: '' }))
      await load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Dimensions</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {currentOrg?.name} — tag manual journal entries by department, location or program
      </p>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={createDimension} className="mb-6 flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">New dimension (e.g. Department)</label>
          <input value={newDimensionName} onChange={(e) => setNewDimensionName(e.target.value)} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : dimensions.length === 0 ? (
        <p className="text-sm text-gray-500">No dimensions yet.</p>
      ) : (
        <div className="space-y-4">
          {dimensions.map((d) => (
            <div key={d.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">{d.name}</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {d.values.map((v) => (
                  <span key={v.id} className="text-xs bg-gray-100 dark:bg-midnight-800 text-gray-700 dark:text-gray-300 rounded-full px-2 py-0.5">
                    {v.name}
                  </span>
                ))}
                {d.values.length === 0 && <span className="text-xs text-gray-500">No values yet</span>}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={newValueName[d.id] || ''}
                  onChange={(e) => setNewValueName((v) => ({ ...v, [d.id]: e.target.value }))}
                  placeholder="New value"
                  className="rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1 text-xs"
                />
                <button onClick={() => createValue(d.id)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
                  Add value
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DimensionsPage() {
  return (
    <ProtectedRoute>
      <DimensionsContent />
    </ProtectedRoute>
  )
}
