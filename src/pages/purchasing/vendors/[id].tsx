import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Vendor = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  paymentTerms: string | null
  taxId: string | null
}

type Bill = { id: string; billNumber: string; status: string; total: string; amountPaid: string; dueDate: string }
type VendorCredit = { id: string; creditNumber: string; amount: string; remainingAmount: string }
type PurchaseOrder = { id: string; poNumber: string; status: string; total: string }

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function VendorDetailContent() {
  const router = useRouter()
  const { id } = router.query
  const { token, currentOrg } = useAuth()
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [vendorCredits, setVendorCredits] = useState<VendorCredit[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/vendors/${id}`, { headers: authHeaders(token) })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Could not load vendor')
        setVendor(body.vendor)
        setBills(body.bills)
        setVendorCredits(body.vendorCredits)
        setPurchaseOrders(body.purchaseOrders)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>
  if (error) return <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
  if (!vendor) return null

  const outstandingTotal = bills
    .filter((b) => b.status !== 'voided')
    .reduce((sum, b) => sum + (Number(b.total) - Number(b.amountPaid)), 0)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">{vendor.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <Link href="/purchasing/vendors" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← All vendors</Link>
      </div>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Profile</h2>
          <dl className="text-sm space-y-1">
            <div><dt className="inline text-gray-500 dark:text-gray-400">Email: </dt><dd className="inline text-gray-900 dark:text-gray-100">{vendor.email || '—'}</dd></div>
            <div><dt className="inline text-gray-500 dark:text-gray-400">Phone: </dt><dd className="inline text-gray-900 dark:text-gray-100">{vendor.phone || '—'}</dd></div>
            <div><dt className="inline text-gray-500 dark:text-gray-400">Address: </dt><dd className="inline text-gray-900 dark:text-gray-100">{vendor.address || '—'}</dd></div>
            <div><dt className="inline text-gray-500 dark:text-gray-400">Payment terms: </dt><dd className="inline text-gray-900 dark:text-gray-100">{vendor.paymentTerms || '—'}</dd></div>
            <div><dt className="inline text-gray-500 dark:text-gray-400">Tax ID: </dt><dd className="inline text-gray-900 dark:text-gray-100">{vendor.taxId || '—'}</dd></div>
          </dl>
        </div>
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Balance</h2>
          <p className="text-2xl font-semibold text-midnight-900 dark:text-white">{currency(outstandingTotal)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total owed across {bills.length} bill(s)</p>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bill history</h2>
      {bills.length === 0 ? (
        <p className="text-sm text-gray-500 mb-6">No bills yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Bill #</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Due date</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{b.billNumber}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{b.status}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(b.dueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(b.total)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(Number(b.total) - Number(b.amountPaid))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Vendor credits</h2>
      {vendorCredits.length === 0 ? (
        <p className="text-sm text-gray-500 mb-6">No vendor credits yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Number</th>
                <th className="px-4 py-2 text-right">Original</th>
                <th className="px-4 py-2 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {vendorCredits.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{c.creditNumber}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(c.amount)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(c.remainingAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Purchase orders</h2>
      {purchaseOrders.length === 0 ? (
        <p className="text-sm text-gray-500">No purchase orders yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">PO #</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2">
                    <Link href={`/purchasing/purchase-orders/${po.id}`} className="text-teal-700 dark:text-teal-400 hover:underline">
                      {po.poNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{po.status}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(po.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function VendorDetailPage() {
  return (
    <ProtectedRoute>
      <VendorDetailContent />
    </ProtectedRoute>
  )
}
