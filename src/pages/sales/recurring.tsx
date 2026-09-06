import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Customer = { id: string; name: string }
type Vendor = { id: string; name: string }
type Account = { id: string; code: string; name: string; type: string }
type Template = { id: string; type: string; frequency: string; nextRunDate: string; lastRunAt: string | null; partyId: string }
type LineForm = { description: string; quantity: string; unitPrice: string; accountId: string }

function emptyLine(): LineForm {
  return { description: '', quantity: '1', unitPrice: '', accountId: '' }
}

function RecurringContent() {
  const { token, currentOrg } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ type: 'invoice', partyId: '', frequency: 'monthly', nextRunDate: new Date().toISOString().slice(0, 10) })
  const [lines, setLines] = useState<LineForm[]>([emptyLine()])

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [tRes, cRes, vRes, aRes] = await Promise.all([
        fetch(`/api/recurring?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/customers?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/vendors?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!tRes.ok) throw new Error('Could not load recurring templates')
      setTemplates(await tRes.json())
      setCustomers(cRes.ok ? await cRes.json() : [])
      setVendors(vRes.ok ? await vRes.json() : [])
      setAccounts(aRes.ok ? await aRes.json() : [])
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

  function updateLine(index: number, patch: Partial<LineForm>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const parties = form.type === 'invoice' ? customers : vendors
  const relevantAccounts = accounts.filter((a) => (form.type === 'invoice' ? a.type === 'income' : a.type === 'expense'))

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form, templateLines: lines }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create recurring template')
      }
      setShowForm(false)
      setLines([emptyLine()])
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRun(id: string) {
    setRunning(id)
    setError(null)
    try {
      const res = await fetch(`/api/recurring/${id}/run`, { method: 'POST', headers: authHeaders(token) })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not run template')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRunning(null)
    }
  }

  function partyName(t: Template) {
    const list = t.type === 'invoice' ? customers : vendors
    return list.find((p) => p.id === t.partyId)?.name || '—'
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Recurring Templates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name} — auto-generate draft invoices and bills</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
          {showForm ? 'Cancel' : 'New template'}
        </button>
      </div>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 max-w-2xl">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, partyId: '' }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
                <option value="invoice">Invoice</option>
                <option value="bill">Bill</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{form.type === 'invoice' ? 'Customer' : 'Vendor'}</label>
              <select required value={form.partyId} onChange={(e) => setForm((f) => ({ ...f, partyId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
                <option value="">Select…</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
          <div className="mb-3 max-w-xs">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Next run date</label>
            <input type="date" value={form.nextRunDate} onChange={(e) => setForm((f) => ({ ...f, nextRunDate: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>

          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Line items</h2>
          <div className="space-y-2 mb-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <input placeholder="Description" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} className="w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
                </div>
                <div className="col-span-2">
                  <input placeholder="Qty" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} className="w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
                </div>
                <div className="col-span-2">
                  <input placeholder="Unit price" value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} className="w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
                </div>
                <div className="col-span-2">
                  <select value={l.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value })} className="w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
                    <option value="">Account…</option>
                    {relevantAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                  </select>
                </div>
                <button type="button" onClick={() => removeLine(i)} className="col-span-1 text-xs text-red-600 hover:underline">Remove</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addLine} className="text-xs text-teal-700 dark:text-teal-400 hover:underline mb-4">+ Add line</button>

          <div>
            <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-500">No recurring templates yet. Templates only run when you click &quot;Run now&quot; — there is no background scheduler.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Party</th>
                <th className="px-4 py-2">Frequency</th>
                <th className="px-4 py-2">Next run</th>
                <th className="px-4 py-2">Last run</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100 capitalize">{t.type}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{partyName(t)}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 capitalize">{t.frequency}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(t.nextRunDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{t.lastRunAt ? new Date(t.lastRunAt).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => handleRun(t.id)} disabled={running === t.id} className="text-xs text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50">
                      {running === t.id ? 'Running…' : 'Run now'}
                    </button>
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

export default function RecurringPage() {
  return (
    <ProtectedRoute>
      <RecurringContent />
    </ProtectedRoute>
  )
}
