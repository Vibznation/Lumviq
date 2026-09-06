import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Vendor = { id: string; name: string }
type Contractor = { id: string; name: string; email: string | null; taxIdLast4: string | null; vendor: Vendor | null }

/**
 * 1099 contractor directory. Tracks who should receive a 1099 at year end;
 * Lumviq does not generate or file 1099 forms (see docs/known-limitations.md).
 * Optionally link a contractor to a Vendor record used for actual bill payments.
 */
function ContractorsContent() {
  const { token, currentOrg } = useAuth()
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', taxIdLast4: '', vendorId: '' })
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [cRes, vRes] = await Promise.all([
        fetch(`/api/contractors?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/vendors?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!cRes.ok) throw new Error('Could not load contractors')
      setContractors(await cRes.json())
      if (vRes.ok) setVendors(await vRes.json())
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
      const res = await fetch('/api/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form, vendorId: form.vendorId || null }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not add contractor')
      setForm({ name: '', email: '', taxIdLast4: '', vendorId: '' })
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Contractors (1099)</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{currentOrg?.name}</p>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Email</label>
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Tax ID (last 4)</label>
          <input value={form.taxIdLast4} onChange={(e) => setForm((f) => ({ ...f, taxIdLast4: e.target.value }))} maxLength={4} className="mt-1 w-20 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Linked vendor</label>
          <select value={form.vendorId} onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
            <option value="">None</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          Add
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : contractors.length === 0 ? (
        <p className="text-sm text-gray-500">No contractors yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Linked vendor</th></tr>
            </thead>
            <tbody>
              {contractors.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{c.name}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{c.email || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{c.vendor?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ContractorsPage() {
  return (
    <ProtectedRoute>
      <ContractorsContent />
    </ProtectedRoute>
  )
}
