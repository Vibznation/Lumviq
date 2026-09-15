import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Line = { id: string; description: string; quantity: string; unitPrice: string; amount: string }
type PurchaseOrder = {
  id: string
  poNumber: string
  status: string
  issueDate: string
  expectedDate: string | null
  total: string
  convertedBillId: string | null
  vendor: { id: string; name: string }
  lines: Line[]
}
type Receipt = { id: string; receivedDate: string; notes: string | null; lines: { purchaseOrderLineId: string; quantityReceived: string }[] }
type MatchLine = { purchaseOrderLineId: string; description: string; orderedQuantity: number; receivedQuantity: number; billedQuantity: number; matched: boolean; discrepancy: string | null }

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-midnight-800 dark:text-gray-300',
  sent: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  received: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-500 dark:bg-midnight-800 dark:text-gray-400',
}

function PurchaseOrderDetailContent() {
  const router = useRouter()
  const { id } = router.query
  const { token, currentOrg } = useAuth()
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [match, setMatch] = useState<{ fullyMatched: boolean; lines: MatchLine[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [receiptDate, setReceiptDate] = useState('')
  const [receiptNotes, setReceiptNotes] = useState('')
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({})

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const poRes = await fetch(`/api/purchase-orders/${id}`, { headers: authHeaders(token) })
      const poBody = await poRes.json()
      if (!poRes.ok) throw new Error(poBody.error || 'Could not load purchase order')
      setPo(poBody)

      const [rRes, mRes] = await Promise.all([
        fetch(`/api/purchase-order-receipts?purchaseOrderId=${id}`, { headers: authHeaders(token) }),
        fetch(`/api/purchase-order-receipts/match?purchaseOrderId=${id}${poBody.convertedBillId ? `&billId=${poBody.convertedBillId}` : ''}`, { headers: authHeaders(token) }),
      ])
      setReceipts(rRes.ok ? await rRes.json() : [])
      setMatch(mRes.ok ? await mRes.json() : null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleSend() {
    if (!po) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ status: 'sent' }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Could not send purchase order')
      if (body.requiresApproval) {
        setInfo('This purchase order exceeds the approval threshold — a request has been sent for sign-off before it is sent to the vendor.')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleConvert() {
    if (!po) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}/convert`, { method: 'POST', headers: authHeaders(token) })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not convert purchase order')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRecordReceipt(e: React.FormEvent) {
    e.preventDefault()
    if (!po || !currentOrg || !receiptDate) return
    const lines = po.lines
      .map((l) => ({ purchaseOrderLineId: l.id, quantityReceived: Number(receiptQuantities[l.id] || 0) }))
      .filter((l) => l.quantityReceived > 0)
    if (lines.length === 0) return setError('Enter a received quantity for at least one line')
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/purchase-order-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, purchaseOrderId: po.id, receivedDate: receiptDate, notes: receiptNotes || undefined, lines }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not record receipt')
      }
      setReceiptDate('')
      setReceiptNotes('')
      setReceiptQuantities({})
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>
  if (error && !po) return <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
  if (!po) return null

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">{po.poNumber}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <Link href={`/purchasing/vendors/${po.vendor.id}`} className="hover:underline">{po.vendor.name}</Link>
            {' · '}
            <span className={'inline-block rounded-full px-2 py-0.5 text-xs font-medium ' + (STATUS_STYLES[po.status] || '')}>{po.status}</span>
          </p>
        </div>
        <Link href="/purchasing/purchase-orders" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← All purchase orders</Link>
      </div>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      {info && <div className="mb-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">{info}</div>}

      <div className="mb-6 flex items-center gap-3">
        {po.status === 'draft' && (
          <button onClick={handleSend} disabled={busy} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            Send to vendor
          </button>
        )}
        {po.status !== 'received' && po.status !== 'closed' && !po.convertedBillId && (
          <button onClick={handleConvert} disabled={busy} className="rounded-md border border-teal-600 text-teal-700 dark:text-teal-400 px-3 py-1.5 text-sm font-medium hover:bg-teal-50 dark:hover:bg-midnight-800 disabled:opacity-50">
            Convert to bill
          </button>
        )}
        {po.convertedBillId && (
          <Link href={`/purchasing/bills/${po.convertedBillId}`} className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            View converted bill →
          </Link>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Lines</h2>
      <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 text-right">Quantity</th>
              <th className="px-4 py-2 text-right">Unit price</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 dark:border-midnight-800">
                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{l.description}</td>
                <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{l.quantity}</td>
                <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(l.unitPrice)}</td>
                <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 dark:border-midnight-700">
              <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100" colSpan={3}>Total</td>
              <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-100">{currency(po.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Record a receipt</h2>
      <form onSubmit={handleRecordReceipt} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid gap-3 max-w-lg">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Received date</label>
          <input type="date" required value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        {po.lines.map((l) => (
          <div key={l.id}>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{l.description} (ordered {l.quantity})</label>
            <input
              value={receiptQuantities[l.id] || ''}
              onChange={(e) => setReceiptQuantities((q) => ({ ...q, [l.id]: e.target.value }))}
              placeholder="Quantity received"
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Notes (optional)</label>
          <input value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={busy} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 w-fit">
          Record receipt
        </button>
      </form>

      {receipts.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Receipt history</h2>
          <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 dark:border-midnight-800">
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{new Date(r.receivedDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {match && (
        <>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            3-way match {match.fullyMatched ? <span className="text-green-700 dark:text-green-400">(fully matched)</span> : <span className="text-amber-700 dark:text-amber-400">(discrepancies found)</span>}
          </h2>
          <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2">Line</th>
                  <th className="px-4 py-2 text-right">Ordered</th>
                  <th className="px-4 py-2 text-right">Received</th>
                  <th className="px-4 py-2 text-right">Billed</th>
                  <th className="px-4 py-2">Discrepancy</th>
                </tr>
              </thead>
              <tbody>
                {match.lines.map((l) => (
                  <tr key={l.purchaseOrderLineId} className="border-t border-gray-100 dark:border-midnight-800">
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{l.description}</td>
                    <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{l.orderedQuantity}</td>
                    <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{l.receivedQuantity}</td>
                    <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{l.billedQuantity}</td>
                    <td className="px-4 py-2 text-xs">
                      {l.matched ? <span className="text-green-700 dark:text-green-400">Matched</span> : <span className="text-amber-700 dark:text-amber-400">{l.discrepancy}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default function PurchaseOrderDetailPage() {
  return (
    <ProtectedRoute>
      <PurchaseOrderDetailContent />
    </ProtectedRoute>
  )
}
