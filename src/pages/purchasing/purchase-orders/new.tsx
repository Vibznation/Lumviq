import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Vendor = { id: string; name: string }
type Account = { id: string; code: string; name: string; type: string }
type LineForm = { description: string; quantity: string; unitPrice: string; accountId: string }

function emptyLine(): LineForm {
  return { description: '', quantity: '1', unitPrice: '', accountId: '' }
}

function NewPurchaseOrderContent() {
  const router = useRouter()
  const { token, currentOrg } = useAuth()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([])
  const [vendorId, setVendorId] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))
  const [lines, setLines] = useState<LineForm[]>([emptyLine()])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!currentOrg) return
    fetch(`/api/vendors?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : []))
      .then((v) => {
        setVendors(v)
        if (v.length > 0) setVendorId(v[0].id)
      })
    fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : []))
      .then((accounts: Account[]) => {
        const expense = accounts.filter((a) => a.type === 'expense')
        setExpenseAccounts(expense)
        if (expense.length > 0) setLines((prev) => prev.map((l) => (l.accountId ? l : { ...l, accountId: expense[0].id })))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  function updateLine(index: number, patch: Partial<LineForm>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine(), accountId: expenseAccounts[0]?.id || '' }])
  }
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const estimatedTotal = lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setError(null)
    if (!vendorId) return setError('Select a vendor')
    if (lines.some((l) => !l.description || !l.accountId || !l.unitPrice)) {
      return setError('Every line needs a description, expense account and unit price')
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, vendorId, issueDate, expectedDate, lines }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create purchase order')
      }
      router.push('/purchasing/purchase-orders')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">New purchase order</h1>
        <Link href="/purchasing/purchase-orders" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">Back to purchase orders</Link>
      </div>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      {vendors.length === 0 ? (
        <p className="text-sm text-gray-500">No vendors yet — <Link href="/purchasing/vendors" className="text-teal-700 dark:text-teal-400 hover:underline">create one first</Link>.</p>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Vendor</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
                {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Issue date</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Expected</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
            </div>
          </div>

          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Line items</h2>
          <div className="space-y-2 mb-3">
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
                    {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                  </select>
                </div>
                <button type="button" onClick={() => removeLine(i)} className="col-span-1 text-xs text-red-600 hover:underline">Remove</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addLine} className="text-xs text-teal-700 dark:text-teal-400 hover:underline mb-4">+ Add line</button>

          <div className="flex items-center justify-between border-t border-gray-100 dark:border-midnight-800 pt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Estimated total: <span className="font-semibold text-midnight-900 dark:text-white">{estimatedTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</span></p>
            <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save purchase order'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function NewPurchaseOrderPage() {
  return (
    <ProtectedRoute>
      <NewPurchaseOrderContent />
    </ProtectedRoute>
  )
}
