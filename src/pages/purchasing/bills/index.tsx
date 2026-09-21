import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import PageHeader from '../../../components/PageHeader'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Bill = {
  id: string
  billNumber: string
  status: string
  total: string
  amountPaid: string
  dueDate: string
  vendor: { name: string }
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-midnight-800 dark:text-gray-300',
  open: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  partially_paid: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  paid: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  voided: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
}

function BillsContent() {
  const { token, currentOrg } = useAuth()
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bills?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load bills')
      setBills(await res.json())
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

  return (
    <div>
      <PageHeader
        icon="🧾"
        eyebrow="Purchasing"
        title="Bills"
        subtitle={currentOrg?.name}
        actions={[{ label: '+ New Bill', href: '/purchasing/bills/new' }]}
        quickLinks={[
          { label: 'Purchase Orders', href: '/purchasing/purchase-orders', icon: '📋' },
          { label: 'Recurring', href: '/sales/recurring', icon: '🔁' },
          { label: 'Vendors', href: '/purchasing/vendors', icon: '🏢' },
        ]}
      />

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : bills.length === 0 ? (
        <p className="text-sm text-gray-500">No bills yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Number</th>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="border-t border-gray-100 dark:border-midnight-800 hover:bg-gray-50 dark:hover:bg-midnight-800">
                  <td className="px-4 py-2">
                    <Link href={`/purchasing/bills/${b.id}`} className="text-teal-700 dark:text-teal-400 hover:underline">
                      {b.billNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{b.vendor?.name}</td>
                  <td className="px-4 py-2">
                    <span className={'inline-block rounded-full px-2 py-0.5 text-xs font-medium ' + (STATUS_STYLES[b.status] || '')}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(b.dueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(b.total)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                    {currency(Number(b.total) - Number(b.amountPaid))}
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

export default function BillsPage() {
  return (
    <ProtectedRoute>
      <BillsContent />
    </ProtectedRoute>
  )
}
