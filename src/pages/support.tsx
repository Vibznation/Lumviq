import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../components/ProtectedRoute'
import { authHeaders, useAuth } from '../lib/auth-context'

type Ticket = { id: string; subject: string; message: string; status: string; priority: string; createdAt: string }

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  in_progress: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  closed: 'bg-gray-100 text-gray-600 dark:bg-midnight-800 dark:text-gray-400',
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

function SupportContent() {
  const { token, currentOrg } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [tierLabel, setTierLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ subject: '', message: '', priority: 'standard' })
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/support-tickets?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load support tickets')
      const data = await res.json()
      setTickets(data.tickets)
      setTierLabel(data.tierLabel)
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

  async function handleStatusChange(ticketId: string, status: string) {
    setUpdatingId(ticketId)
    setError(null)
    try {
      const res = await fetch(`/api/support-tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not update ticket status')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !form.subject || !form.message) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not submit ticket')
      }
      setForm({ subject: '', message: '', priority: 'standard' })
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Support</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}{tierLabel ? ` — ${tierLabel}` : ''}</p>
      </div>

      <div className="mb-6 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-midnight-800 border border-gray-200 dark:border-midnight-700 rounded-md px-3 py-2">
        This is an in-app ticket log, not a live chat — there is no external ticketing system integration. Your
        plan determines the expected response time shown above.
      </div>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Subject</label>
          <input required value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Message</label>
          <textarea required value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={3} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Priority</label>
          <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
            <option value="standard">Standard</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit ticket'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : tickets.length === 0 ? (
        <p className="text-sm text-gray-500">No support tickets yet.</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t.subject}</h3>
                <select
                  value={t.status}
                  onChange={(e) => handleStatusChange(t.id, e.target.value)}
                  disabled={updatingId === t.id}
                  className={`text-xs px-2 py-0.5 rounded-full border-0 disabled:opacity-50 ${STATUS_STYLES[t.status] || STATUS_STYLES.open}`}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t.message}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t.priority} priority — opened {new Date(t.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SupportPage() {
  return (
    <ProtectedRoute>
      <SupportContent />
    </ProtectedRoute>
  )
}
