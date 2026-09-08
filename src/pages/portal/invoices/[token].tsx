import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

interface InvoiceLine {
  id: string
  description: string
  quantity: string
  unitPrice: string
  amount: string
}

interface PortalInvoice {
  invoiceNumber: string
  status: string
  issueDate: string
  dueDate: string
  currency: string
  subtotal: string
  taxTotal: string
  total: string
  amountPaid: string
  lines: InvoiceLine[]
  customer: { name: string; email: string } | null
  organization: { name: string }
  onlinePaymentAvailable: boolean
}

export default function InvoicePortalPage() {
  const router = useRouter()
  const { token } = router.query
  const [invoice, setInvoice] = useState<PortalInvoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(`/api/portal/invoices/${token}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Failed to load invoice')
        setInvoice(body)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <>
      <Head>
        <title>Invoice{invoice ? ` ${invoice.invoiceNumber}` : ''}</title>
      </Head>
      <div className="min-h-screen bg-slate-50 flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          {loading && <p className="text-slate-500">Loading invoice...</p>}
          {error && <p className="text-red-600">{error}</p>}
          {invoice && (
            <>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-xl font-semibold text-slate-900">{invoice.organization.name}</h1>
                  <p className="text-sm text-slate-500">Invoice {invoice.invoiceNumber}</p>
                </div>
                <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
                  {invoice.status.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <p className="text-slate-500">Billed to</p>
                  <p className="font-medium text-slate-900">{invoice.customer?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Issue date</p>
                  <p className="font-medium text-slate-900">{new Date(invoice.issueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-slate-500">Due date</p>
                  <p className="font-medium text-slate-900">{new Date(invoice.dueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-slate-500">Currency</p>
                  <p className="font-medium text-slate-900">{invoice.currency}</p>
                </div>
              </div>

              <table className="w-full text-sm mb-6">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Unit price</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr key={line.id} className="border-b border-slate-100">
                      <td className="py-2 text-slate-800">{line.description}</td>
                      <td className="py-2 text-right text-slate-800">{line.quantity}</td>
                      <td className="py-2 text-right text-slate-800">{line.unitPrice}</td>
                      <td className="py-2 text-right text-slate-800">{line.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-col items-end gap-1 text-sm mb-6">
                <div className="flex gap-8">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-900">{invoice.subtotal}</span>
                </div>
                <div className="flex gap-8">
                  <span className="text-slate-500">Tax</span>
                  <span className="text-slate-900">{invoice.taxTotal}</span>
                </div>
                <div className="flex gap-8 font-semibold">
                  <span className="text-slate-700">Total</span>
                  <span className="text-slate-900">{invoice.total}</span>
                </div>
                <div className="flex gap-8">
                  <span className="text-slate-500">Paid</span>
                  <span className="text-slate-900">{invoice.amountPaid}</span>
                </div>
              </div>

              {!invoice.onlinePaymentAvailable && (
                <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  Online payment isn&apos;t available for this invoice yet. Please contact {invoice.organization.name} directly to arrange payment.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
