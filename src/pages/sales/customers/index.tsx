import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import PageHeader from '../../../components/PageHeader'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  billingAddress: string | null
}

function CustomersContent() {
  const { token, currentOrg } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', billingAddress: '' })
  const [submitting, setSubmitting] = useState(false)

  async function loadCustomers() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/customers?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load customers')
      setCustomers(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create customer')
      }
      setForm({ name: '', email: '', phone: '', billingAddress: '' })
      setShowForm(false)
      await loadCustomers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon="👤"
        eyebrow="Sales"
        title="Customers"
        subtitle={currentOrg?.name}
        quickLinks={[
          { label: 'Invoices', href: '/sales/invoices', icon: '💳' },
          { label: 'Products & Services', href: '/sales/products', icon: '📦' },
        ]}
      />

      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-xl bg-teal-600 text-white px-3.5 py-2 text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Customer'}
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
            <label htmlFor="name" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
            <input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="phone" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Phone</label>
            <input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="billingAddress" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Billing address</label>
            <textarea
              id="billingAddress"
              value={form.billingAddress}
              onChange={(e) => setForm((f) => ({ ...f, billingAddress: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save customer'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="text-sm text-gray-500">No customers yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Phone</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{c.name}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{c.email || '—'}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{c.phone || '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/sales/customers/${c.id}`} className="text-teal-700 dark:text-teal-400 hover:underline">
                      View →
                    </Link>
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

export default function CustomersPage() {
  return (
    <ProtectedRoute>
      <CustomersContent />
    </ProtectedRoute>
  )
}
