import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Webhook = { id: string; url: string; eventTypes: string[]; active: boolean; createdAt: string }

const EVENT_TYPES = ['invoice.paid', 'bill.paid', 'invoice.overdue', 'approval.requested']

/**
 * Outbound webhook subscriptions for the public developer API. No public
 * API exists yet to generate real events — deliveries are logged but not
 * actually sent over HTTP yet. See src/lib/webhooks.ts and
 * docs/known-limitations.md.
 */
function WebhooksContent() {
  const { token, currentOrg } = useAuth()
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [form, setForm] = useState({ url: '', eventTypes: [] as string[] })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/webhooks?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load webhooks')
      setWebhooks(await res.json())
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

  function toggleEvent(type: string) {
    setForm((f) => ({
      ...f,
      eventTypes: f.eventTypes.includes(type) ? f.eventTypes.filter((t) => t !== type) : [...f.eventTypes, type],
    }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !form.url || form.eventTypes.length === 0) return
    setSubmitting(true)
    setError(null)
    setNewSecret(null)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Could not create webhook')
      setNewSecret(json.secret)
      setForm({ url: '', eventTypes: [] })
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE', headers: authHeaders(token) })
    await load()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Webhooks</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {currentOrg?.name} — deliveries are logged but not yet sent over HTTP (no public API events exist yet)
      </p>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {newSecret && (
        <div className="mb-4 text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-md px-3 py-2">
          Webhook secret (shown once): <code className="font-mono">{newSecret}</code>
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Endpoint URL</label>
          <input required type="url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Events</label>
          <div className="flex flex-wrap gap-2">
            {EVENT_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-1.5 text-xs bg-gray-100 dark:bg-midnight-800 rounded-full px-2 py-1">
                <input type="checkbox" checked={form.eventTypes.includes(type)} onChange={() => toggleEvent(type)} />
                {type}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          Create webhook
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : webhooks.length === 0 ? (
        <p className="text-sm text-gray-500">No webhooks yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="px-4 py-2">URL</th><th className="px-4 py-2">Events</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100 break-all">{w.url}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{w.eventTypes.join(', ')}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => remove(w.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function WebhooksPage() {
  return (
    <ProtectedRoute>
      <WebhooksContent />
    </ProtectedRoute>
  )
}
