import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type WorkflowRule = { id: string; name: string; triggerType: string; triggerConfig: any; actionType: string; active: boolean; lastRunAt: string | null }

const TRIGGERS = [
  { value: 'invoice_overdue', label: 'Invoice overdue', configLabel: 'Days overdue', configKey: 'daysOverdue' },
  { value: 'bill_due_soon', label: 'Bill due soon', configLabel: 'Days ahead', configKey: 'daysAhead' },
  { value: 'low_stock', label: 'Low stock', configLabel: null, configKey: null },
] as const

function WorkflowsContent() {
  const { token, currentOrg } = useAuth()
  const [rules, setRules] = useState<WorkflowRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', triggerType: 'invoice_overdue', configValue: '7', actionType: 'notify' })
  const [submitting, setSubmitting] = useState(false)
  const [running, setRunning] = useState(false)
  const [runSummary, setRunSummary] = useState<Array<{ ruleId: string; ruleName: string; matches: number }> | null>(null)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workflows?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load workflow rules')
      setRules(await res.json())
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

  const trigger = TRIGGERS.find((t) => t.value === form.triggerType)!

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !form.name) return
    setSubmitting(true)
    setError(null)
    try {
      const triggerConfig = trigger.configKey ? { [trigger.configKey]: Number(form.configValue) } : {}
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, name: form.name, triggerType: form.triggerType, triggerConfig, actionType: form.actionType }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create workflow rule')
      }
      setForm({ name: '', triggerType: 'invoice_overdue', configValue: '7', actionType: 'notify' })
      setShowForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRunDue() {
    if (!currentOrg) return
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/workflows/run-due', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not run workflow rules')
      }
      const data = await res.json()
      setRunSummary(data.summary)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Link href="/settings/organization" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← Back to organization settings</Link>
      </div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Workflow automation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name} — rules run only when you click &quot;Run due rules&quot; (no background scheduler)</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleRunDue} disabled={running} className="text-sm text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50">
            {running ? 'Running…' : 'Run due rules'}
          </button>
          <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
            {showForm ? 'Cancel' : 'New rule'}
          </button>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      {runSummary && (
        <div className="mb-4 text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-3 py-2">
          Evaluated {runSummary.length} rule(s): {runSummary.length > 0 ? runSummary.map((r) => `${r.ruleName} (${r.matches} match${r.matches === 1 ? '' : 'es'})`).join(', ') : 'none'}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Rule name</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Trigger</label>
            <select value={form.triggerType} onChange={(e) => setForm((f) => ({ ...f, triggerType: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {trigger.configKey && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{trigger.configLabel}</label>
              <input type="number" value={form.configValue} onChange={(e) => setForm((f) => ({ ...f, configValue: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Action</label>
            <select value={form.actionType} onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              <option value="notify">Send notification</option>
              <option value="create_approval">Create approval request</option>
            </select>
          </div>
          <div className="col-span-2">
            <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save rule'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-gray-500">No workflow rules yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Trigger</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Last run</th></tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.name}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{TRIGGERS.find((t) => t.value === r.triggerType)?.label || r.triggerType}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 capitalize">{r.actionType}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.lastRunAt ? new Date(r.lastRunAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function WorkflowsPage() {
  return (
    <ProtectedRoute>
      <WorkflowsContent />
    </ProtectedRoute>
  )
}
