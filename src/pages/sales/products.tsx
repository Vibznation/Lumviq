import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import PageHeader from '../../components/PageHeader'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Account = { id: string; code: string; name: string; type: string }
type Product = {
  id: string
  sku: string | null
  name: string
  type: string
  salesPrice: string | null
  costPrice: string | null
  incomeAccountId: string
  expenseAccountId: string
  inventoryAssetAccountId: string | null
  reorderPoint: string | null
}

const emptyForm = {
  sku: '',
  name: '',
  type: 'service',
  salesPrice: '',
  costPrice: '',
  incomeAccountId: '',
  expenseAccountId: '',
  inventoryAssetAccountId: '',
  reorderPoint: '',
}

function ProductsContent() {
  const { token, currentOrg } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [incomeAccounts, setIncomeAccounts] = useState<Account[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([])
  const [assetAccounts, setAssetAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/products?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load products')
      setProducts(await res.json())
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

  useEffect(() => {
    if (!currentOrg) return
    fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : []))
      .then((accounts: Account[]) => {
        setIncomeAccounts(accounts.filter((a) => a.type === 'income'))
        setExpenseAccounts(accounts.filter((a) => a.type === 'expense'))
        setAssetAccounts(accounts.filter((a) => a.type === 'asset'))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          sku: form.sku || undefined,
          name: form.name,
          type: form.type,
          salesPrice: form.salesPrice || undefined,
          costPrice: form.costPrice || undefined,
          incomeAccountId: form.incomeAccountId,
          expenseAccountId: form.expenseAccountId,
          inventoryAssetAccountId: form.type === 'inventory' ? form.inventoryAssetAccountId : undefined,
          reorderPoint: form.type === 'inventory' ? form.reorderPoint || undefined : undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create product')
      }
      setForm(emptyForm)
      setShowForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon="📦"
        eyebrow="Sales"
        title="Products & Services"
        subtitle={currentOrg?.name}
        quickLinks={[
          { label: 'Invoices', href: '/sales/invoices', icon: '💳' },
          { label: 'Customers', href: '/sales/customers', icon: '👤' },
        ]}
      />
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-xl bg-teal-600 text-white px-3.5 py-2 text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Product/Service'}
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
            <label htmlFor="sku" className="block text-xs font-medium text-gray-600 dark:text-gray-400">SKU</label>
            <input
              id="sku"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="type" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Type</label>
            <select
              id="type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="service">Service</option>
              <option value="non-inventory">Non-inventory product</option>
              <option value="inventory">Inventory-tracked product</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="salesPrice" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Sales price</label>
              <input
                id="salesPrice"
                type="number"
                step="0.01"
                value={form.salesPrice}
                onChange={(e) => setForm((f) => ({ ...f, salesPrice: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="costPrice" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Cost price</label>
              <input
                id="costPrice"
                type="number"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="incomeAccountId" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Income account</label>
            <select
              id="incomeAccountId"
              required
              value={form.incomeAccountId}
              onChange={(e) => setForm((f) => ({ ...f, incomeAccountId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {incomeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="expenseAccountId" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Expense / COGS account</label>
            <select
              id="expenseAccountId"
              required
              value={form.expenseAccountId}
              onChange={(e) => setForm((f) => ({ ...f, expenseAccountId: e.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              <option value="">Select…</option>
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          {form.type === 'inventory' && (
            <>
              <div>
                <label htmlFor="inventoryAssetAccountId" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Inventory asset account</label>
                <select
                  id="inventoryAssetAccountId"
                  required
                  value={form.inventoryAssetAccountId}
                  onChange={(e) => setForm((f) => ({ ...f, inventoryAssetAccountId: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                >
                  <option value="">Select…</option>
                  {assetAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reorderPoint" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Reorder point</label>
                <input
                  id="reorderPoint"
                  type="number"
                  value={form.reorderPoint}
                  onChange={(e) => setForm((f) => ({ ...f, reorderPoint: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>
            </>
          )}
          <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save product/service'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-gray-500">No products or services yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">Sales price</th>
                <th className="px-4 py-2 text-right">Cost price</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{p.name}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{p.sku || '—'}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{p.type}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{p.salesPrice ? Number(p.salesPrice).toFixed(2) : '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{p.costPrice ? Number(p.costPrice).toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function ProductsPage() {
  return (
    <ProtectedRoute>
      <ProductsContent />
    </ProtectedRoute>
  )
}
