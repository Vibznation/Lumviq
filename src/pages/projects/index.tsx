import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Customer = { id: string; name: string }
type TimeEntry = { id: string; date: string; hours: string; billable: boolean; rate: string | null; description: string | null }
type Project = { id: string; name: string; status: string; budgetAmount: string | null; timeEntries: TimeEntry[] }

function currency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function ProjectsContent() {
  const { token, currentOrg } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', customerId: '', budgetAmount: '' })
  const [submitting, setSubmitting] = useState(false)
  const [logging, setLogging] = useState<string | null>(null)
  const [timeForm, setTimeForm] = useState({ date: new Date().toISOString().slice(0, 10), hours: '', rate: '', description: '' })

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [pRes, cRes] = await Promise.all([
        fetch(`/api/projects?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/customers?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!pRes.ok) throw new Error('Could not load projects')
      setProjects(await pRes.json())
      setCustomers(cRes.ok ? await cRes.json() : [])
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, name: form.name, customerId: form.customerId || undefined, budgetAmount: form.budgetAmount || undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create project')
      }
      setForm({ name: '', customerId: '', budgetAmount: '' })
      setShowForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogTime(projectId: string) {
    if (!currentOrg) return
    setError(null)
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, projectId, ...timeForm, rate: timeForm.rate || undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not log time')
      }
      setLogging(null)
      setTimeForm({ date: new Date().toISOString().slice(0, 10), hours: '', rate: '', description: '' })
      await load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Projects & Time</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
          {showForm ? 'Cancel' : 'New project'}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid gap-3 max-w-md">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Customer (optional)</label>
            <select value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              <option value="">None</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Budget (optional)</label>
            <input value={form.budgetAmount} onChange={(e) => setForm((f) => ({ ...f, budgetAmount: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save project'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-gray-500">No projects yet.</p>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => {
            const billableHours = p.timeEntries.filter((t) => t.billable).reduce((s, t) => s + Number(t.hours), 0)
            const totalHours = p.timeEntries.reduce((s, t) => s + Number(t.hours), 0)
            const billedValue = p.timeEntries.filter((t) => t.billable).reduce((s, t) => s + Number(t.hours) * Number(t.rate || 0), 0)
            const budget = p.budgetAmount ? Number(p.budgetAmount) : null
            return (
              <div key={p.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-midnight-900 dark:text-white">{p.name}</h2>
                  <button onClick={() => setLogging(logging === p.id ? null : p.id)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
                    Log time
                  </button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {totalHours.toFixed(2)}h logged ({billableHours.toFixed(2)}h billable) &middot; estimated billable value {currency(billedValue)}
                  {budget != null && (
                    <> &middot; budget {currency(budget)} ({budget > 0 ? Math.round((billedValue / budget) * 100) : 0}% used)</>
                  )}
                </p>
                {logging === p.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-midnight-800 grid grid-cols-4 gap-2 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Date</label>
                      <input type="date" value={timeForm.date} onChange={(e) => setTimeForm((f) => ({ ...f, date: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Hours</label>
                      <input value={timeForm.hours} onChange={(e) => setTimeForm((f) => ({ ...f, hours: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Rate/hr</label>
                      <input value={timeForm.rate} onChange={(e) => setTimeForm((f) => ({ ...f, rate: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
                    </div>
                    <button onClick={() => handleLogTime(p.id)} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
                      Add
                    </button>
                    <input
                      value={timeForm.description}
                      onChange={(e) => setTimeForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Description"
                      className="col-span-4 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <ProtectedRoute>
      <ProjectsContent />
    </ProtectedRoute>
  )
}
