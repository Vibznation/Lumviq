import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Account = { id: string; code: string; name: string; type: string; subtype: string | null }
type Location = { id: string; name: string; address: string | null }
type Product = {
  id: string
  sku: string | null
  name: string
  type: string
  salesPrice: string | null
  costPrice: string | null
  quantityOnHand: string
  reorderPoint: string | null
}

function currency(n: string | number | null) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function InventoryContent() {
  const { token, currentOrg } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    sku: '', name: '', type: 'service', salesPrice: '', costPrice: '',
    incomeAccountId: '', expenseAccountId: '', inventoryAssetAccountId: '', reorderPoint: '',
  })
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [locations, setLocations] = useState<Location[]>([])
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [locationForm, setLocationForm] = useState({ name: '', address: '' })
  const [submittingLocation, setSubmittingLocation] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [pRes, aRes, lRes] = await Promise.all([
        fetch(`/api/products?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/locations?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!pRes.ok) throw new Error('Could not load products')
      setProducts(await pRes.json())
      const accs = aRes.ok ? await aRes.json() : []
      setAccounts(accs)
      setLocations(lRes.ok ? await lRes.json() : [])
      const income = accs.find((a: Account) => a.type === 'income')
      const expense = accs.find((a: Account) => a.type === 'expense')
      const assetAcc = accs.find((a: Account) => a.subtype === 'inventory')
      setForm((f) => ({
        ...f,
        incomeAccountId: f.incomeAccountId || income?.id || '',
        expenseAccountId: f.expenseAccountId || expense?.id || '',
        inventoryAssetAccountId: f.inventoryAssetAccountId || assetAcc?.id || '',
      }))
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
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create product')
      }
      setForm((f) => ({ ...f, sku: '', name: '', salesPrice: '', costPrice: '', reorderPoint: '' }))
      setShowForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAdjust(id: string) {
    setError(null)
    try {
      const res = await fetch(`/api/products/${id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ quantity: adjustQty, note: adjustNote }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not adjust stock')
      }
      setAdjusting(null)
      setAdjustQty('')
      setAdjustNote('')
      await load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleCreateLocation(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setSubmittingLocation(true)
    setError(null)
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...locationForm }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create location')
      }
      setLocationForm({ name: '', address: '' })
      setShowLocationForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmittingLocation(false)
    }
  }

  const incomeAccounts = accounts.filter((a) => a.type === 'income')
  const expenseAccounts = accounts.filter((a) => a.type === 'expense')
  const assetAccounts = accounts.filter((a) => a.type === 'asset')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Products & Inventory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name} — average cost valuation</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/reports?tab=Product+Profitability" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Product profitability →
          </Link>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700"
          >
            {showForm ? 'Cancel' : 'New product'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid grid-cols-2 gap-3 max-w-2xl">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">SKU</label>
            <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              <option value="service">Service</option>
              <option value="non_inventory">Non-inventory</option>
              <option value="inventory">Inventory (tracked)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Sales price</label>
            <input value={form.salesPrice} onChange={(e) => setForm((f) => ({ ...f, salesPrice: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Income account</label>
            <select value={form.incomeAccountId} onChange={(e) => setForm((f) => ({ ...f, incomeAccountId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              <option value="">--</option>
              {incomeAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Expense/COGS account</label>
            <select value={form.expenseAccountId} onChange={(e) => setForm((f) => ({ ...f, expenseAccountId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              <option value="">--</option>
              {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </div>
          {form.type === 'inventory' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Inventory asset account</label>
                <select value={form.inventoryAssetAccountId} onChange={(e) => setForm((f) => ({ ...f, inventoryAssetAccountId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
                  <option value="">--</option>
                  {assetAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Reorder point</label>
                <input value={form.reorderPoint} onChange={(e) => setForm((f) => ({ ...f, reorderPoint: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
              </div>
            </>
          )}
          <div className="col-span-2">
            <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save product'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-gray-500">No products yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-right">On hand</th>
                <th className="px-4 py-2 text-right">Avg cost</th>
                <th className="px-4 py-2 text-right">Sales price</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const low = p.type === 'inventory' && p.reorderPoint != null && Number(p.quantityOnHand) <= Number(p.reorderPoint)
                return (
                  <React.Fragment key={p.id}>
                    <tr className="border-t border-gray-100 dark:border-midnight-800">
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{p.name} {p.sku ? <span className="text-xs text-gray-400">({p.sku})</span> : null}</td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{p.type}</td>
                      <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                        {p.type === 'inventory' ? p.quantityOnHand : '—'}
                        {low && <span className="ml-1 text-xs text-amber-600 font-medium">Low stock</span>}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">{p.type === 'inventory' ? currency(p.costPrice) : '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(p.salesPrice)}</td>
                      <td className="px-4 py-2 text-right">
                        {p.type === 'inventory' && (
                          <button onClick={() => setAdjusting(adjusting === p.id ? null : p.id)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
                            Adjust stock
                          </button>
                        )}
                      </td>
                    </tr>
                    {adjusting === p.id && (
                      <tr className="border-t border-gray-100 dark:border-midnight-800 bg-gray-50 dark:bg-midnight-800">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-end gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Quantity change</label>
                              <input value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} placeholder="e.g. -2 or 5" className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-900 dark:text-gray-100 px-2 py-1.5 text-sm w-32" />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Reason</label>
                              <input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="e.g. stocktake correction" className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-900 dark:text-gray-100 px-2 py-1.5 text-sm" />
                            </div>
                            <button onClick={() => handleAdjust(p.id)} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
                              Apply
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Locations</h2>
          <button onClick={() => setShowLocationForm((s) => !s)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
            {showLocationForm ? 'Cancel' : '+ New location'}
          </button>
        </div>
        {showLocationForm && (
          <form onSubmit={handleCreateLocation} className="mb-4 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid grid-cols-2 gap-3 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
              <input required value={locationForm.name} onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Address (optional)</label>
              <input value={locationForm.address} onChange={(e) => setLocationForm((f) => ({ ...f, address: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <button type="submit" disabled={submittingLocation} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                {submittingLocation ? 'Saving…' : 'Save location'}
              </button>
            </div>
          </form>
        )}
        {locations.length === 0 ? (
          <p className="text-sm text-gray-500">No locations yet — add one to track inventory across warehouses or stores.</p>
        ) : (
          <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden max-w-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Address</th></tr>
              </thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100 dark:border-midnight-800">
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{l.name}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{l.address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function InventoryPage() {
  return (
    <ProtectedRoute>
      <InventoryContent />
    </ProtectedRoute>
  )
}
