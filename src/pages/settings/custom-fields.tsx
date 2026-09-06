import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type CustomField = { id: string; entityType: string; name: string; fieldType: string; options: any }

const ENTITY_TYPES = ['customer', 'vendor', 'invoice', 'bill', 'project', 'product'] as const

function CustomFieldsContent() {
  const { token, currentOrg } = useAuth()
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ entityType: 'customer', name: '', fieldType: 'text', options: '' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/custom-fields?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load custom fields')
      setFields(await res.json())
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
    if (!currentOrg || !form.name) return
    setSubmitting(true)
    setError(null)
    try {
      const options = form.fieldType === 'select' ? form.options.split(',').map((o) => o.trim()).filter(Boolean) : []
      const res = await fetch('/api/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, entityType: form.entityType, name: form.name, fieldType: form.fieldType, options }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create custom field')
      }
      setForm({ entityType: form.entityType, name: '', fieldType: 'text', options: '' })
      setShowForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Link href="/settings/organization" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← Back to organization settings</Link>
      </div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Custom fields</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name} — add extra fields to your records</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
          {showForm ? 'Cancel' : 'New field'}
        </button>
      </div>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Applies to</label>
            <select value={form.entityType} onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Field name</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Type</label>
            <select value={form.fieldType} onChange={(e) => setForm((f) => ({ ...f, fieldType: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select (dropdown)</option>
            </select>
          </div>
          {form.fieldType === 'select' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Options (comma separated)</label>
              <input value={form.options} onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
            </div>
          )}
          <div className="col-span-2">
            <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save field'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : fields.length === 0 ? (
        <p className="text-sm text-gray-500">No custom fields yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="px-4 py-2">Applies to</th><th className="px-4 py-2">Field</th><th className="px-4 py-2">Type</th></tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100 capitalize">{f.entityType}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{f.name}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 capitalize">{f.fieldType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function CustomFieldsPage() {
  return (
    <ProtectedRoute>
      <CustomFieldsContent />
    </ProtectedRoute>
  )
}
