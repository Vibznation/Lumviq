import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Customer = { id: string; name: string }
type TimeEntry = { id: string; date: string; hours: string; billable: boolean; rate: string | null; description: string | null }
type Project = { id: string; name: string; status: string; budgetAmount: string | null; customerId: string | null; timeEntries: TimeEntry[] }
type Account = { id: string; type: string; name: string }
type Member = { userId: string; name: string | null; email: string }

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
  const [accounts, setAccounts] = useState<Account[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [assigning, setAssigning] = useState<string | null>(null)
  const [assignForm, setAssignForm] = useState({ userId: '', allocationPercent: '100', roleLabel: '' })
  const [invoicing, setInvoicing] = useState<string | null>(null)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [pRes, cRes, aRes, mRes] = await Promise.all([
        fetch(`/api/projects?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/customers?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/orgs/members?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!pRes.ok) throw new Error('Could not load projects')
      setProjects(await pRes.json())
      setCustomers(cRes.ok ? await cRes.json() : [])
      setAccounts(aRes.ok ? await aRes.json() : [])
      setMembers(mRes.ok ? await mRes.json() : [])
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

  async function handleAssign(projectId: string) {
    if (!currentOrg || !assignForm.userId) return
    setError(null)
    try {
      const res = await fetch('/api/project-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, projectId, userId: assignForm.userId, allocationPercent: assignForm.allocationPercent, roleLabel: assignForm.roleLabel || undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not assign staff')
      }
      setAssigning(null)
      setAssignForm({ userId: '', allocationPercent: '100', roleLabel: '' })
      await load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleProgressInvoice(project: Project) {
    if (!currentOrg) return
    const incomeAccount = accounts.find((a) => a.type === 'income')
    if (!incomeAccount) return setError('Create an income account in the Chart of Accounts before invoicing time')
    if (!project.customerId) return setError('This project has no customer to invoice')
    setInvoicing(project.id)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${project.id}/progress-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ accountId: incomeAccount.id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create a progress invoice')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setInvoicing(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Projects & Time</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/reports/job-costing" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Job costing report →
          </Link>
          <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
            {showForm ? 'Cancel' : 'New project'}
          </button>
        </div>
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
                  <div className="flex items-center gap-3">
                    <button onClick={() => setAssigning(assigning === p.id ? null : p.id)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
                      Assign staff
                    </button>
                    <button onClick={() => handleProgressInvoice(p)} disabled={invoicing === p.id} className="text-xs text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50">
                      {invoicing === p.id ? 'Invoicing…' : 'Invoice time'}
                    </button>
                    <button onClick={() => setLogging(logging === p.id ? null : p.id)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
                      Log time
                    </button>
                  </div>
                </div>
                {assigning === p.id && (
                  <div className="mb-3 pb-3 border-b border-gray-100 dark:border-midnight-800 grid grid-cols-4 gap-2 items-end">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Team member</label>
                      <select value={assignForm.userId} onChange={(e) => setAssignForm((f) => ({ ...f, userId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
                        <option value="">Select…</option>
                        {members.map((m) => <option key={m.userId} value={m.userId}>{m.name || m.email}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Allocation %</label>
                      <input value={assignForm.allocationPercent} onChange={(e) => setAssignForm((f) => ({ ...f, allocationPercent: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
                    </div>
                    <button onClick={() => handleAssign(p.id)} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
                      Assign
                    </button>
                  </div>
                )}
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
