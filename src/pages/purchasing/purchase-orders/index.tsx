import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type PurchaseOrder = { id: string; poNumber: string; status: string; total: string; expectedDate: string | null; vendor: { name: string } }

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-midnight-800 dark:text-gray-300',
  sent: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  received: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-500 dark:bg-midnight-800 dark:text-gray-400',
}

function PurchaseOrdersContent() {
  const { token, currentOrg } = useAuth()
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [converting, setConverting] = useState<string | null>(null)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/purchase-orders?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load purchase orders')
      setPos(await res.json())
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

  async function handleConvert(id: string) {
    setConverting(id)
    setError(null)
    try {
      const res = await fetch(`/api/purchase-orders/${id}/convert`, { method: 'POST', headers: authHeaders(token) })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not convert purchase order')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setConverting(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Purchase Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/purchasing/vendor-credits" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">Vendor credits →</Link>
          <Link href="/purchasing/reimbursements" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">Reimbursements →</Link>
          <Link href="/purchasing/purchase-orders/new" className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">New PO</Link>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : pos.length === 0 ? (
        <p className="text-sm text-gray-500">No purchase orders yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Number</th>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Expected</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => (
                <tr key={po.id} className="border-t border-gray-100 dark:border-midnight-800 hover:bg-gray-50 dark:hover:bg-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{po.poNumber}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{po.vendor?.name}</td>
                  <td className="px-4 py-2"><span className={'inline-block rounded-full px-2 py-0.5 text-xs font-medium ' + (STATUS_STYLES[po.status] || '')}>{po.status}</span></td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(po.total)}</td>
                  <td className="px-4 py-2 text-right">
                    {po.status !== 'received' && po.status !== 'closed' && (
                      <button onClick={() => handleConvert(po.id)} disabled={converting === po.id} className="text-xs text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50">
                        {converting === po.id ? 'Converting…' : 'Convert to bill'}
                      </button>
                    )}
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

export default function PurchaseOrdersPage() {
  return (
    <ProtectedRoute>
      <PurchaseOrdersContent />
    </ProtectedRoute>
  )
}
