import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Customer = {
  id: string
  name: string
  email: string | null
  phone: string | null
  billingAddress: string | null
}

type Invoice = {
  id: string
  invoiceNumber: string
  status: string
  total: string
  amountPaid: string
  dueDate: string
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function CustomerDetailContent() {
  const router = useRouter()
  const { id } = router.query
  const { token, currentOrg } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/customers/${id}`, { headers: authHeaders(token) })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Could not load customer')
        setCustomer(body.customer)
        setInvoices(body.invoices)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>
  if (error) return <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
  if (!customer) return null

  const outstandingTotal = invoices
    .filter((i) => i.status !== 'voided')
    .reduce((sum, i) => sum + (Number(i.total) - Number(i.amountPaid)), 0)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">{customer.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/sales/customers" className="text-teal-700 dark:text-teal-400 hover:underline">← All customers</Link>
          <Link
            href={`/reports?tab=Customer+Statements&customerId=${customer.id}`}
            className="text-teal-700 dark:text-teal-400 hover:underline"
          >
            Statement →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Profile</h2>
          <dl className="text-sm space-y-1">
            <div><dt className="inline text-gray-500 dark:text-gray-400">Email: </dt><dd className="inline text-gray-900 dark:text-gray-100">{customer.email || '—'}</dd></div>
            <div><dt className="inline text-gray-500 dark:text-gray-400">Phone: </dt><dd className="inline text-gray-900 dark:text-gray-100">{customer.phone || '—'}</dd></div>
            <div><dt className="inline text-gray-500 dark:text-gray-400">Billing address: </dt><dd className="inline text-gray-900 dark:text-gray-100">{customer.billingAddress || '—'}</dd></div>
          </dl>
        </div>
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Balance</h2>
          <p className="text-2xl font-semibold text-midnight-900 dark:text-white">{currency(outstandingTotal)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total outstanding across {invoices.length} invoice(s)</p>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Invoice history</h2>
      {invoices.length === 0 ? (
        <p className="text-sm text-gray-500">No invoices yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Invoice #</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Due date</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2">
                    <Link href={`/sales/invoices/${inv.id}`} className="text-teal-700 dark:text-teal-400 hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{inv.status}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(inv.dueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(inv.total)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(Number(inv.total) - Number(inv.amountPaid))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function CustomerDetailPage() {
  return (
    <ProtectedRoute>
      <CustomerDetailContent />
    </ProtectedRoute>
  )
}
