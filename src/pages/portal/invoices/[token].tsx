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
  organization: { name: string; logoUrl?: string | null; brandColor?: string | null }
  onlinePaymentAvailable: boolean
}

export default function InvoicePortalPage() {
  const router = useRouter()
  const { token } = router.query
  const [invoice, setInvoice] = useState<PortalInvoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const loadInvoice = () => {
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
  }

  useEffect(() => {
    loadInvoice()
  }, [token])

  async function handlePay() {
    if (!token) return
    setPaying(true)
    setPaymentError(null)

    try {
      const res = await fetch(`/api/portal/invoices/${token}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Payment failed')
      }
      setPaymentSuccess(true)
      loadInvoice()
    } catch (err: any) {
      setPaymentError(err?.message || 'Payment processing failed')
    } finally {
      setPaying(false)
    }
  }

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
                <div className="flex items-center gap-3">
                  {invoice.organization.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={invoice.organization.logoUrl} alt={invoice.organization.name} className="h-10 w-10 object-contain rounded" />
                  )}
                  <div>
                    <h1 className="text-xl font-semibold" style={{ color: invoice.organization.brandColor || undefined }}>{invoice.organization.name}</h1>
                    <p className="text-sm text-slate-500">Invoice {invoice.invoiceNumber}</p>
                  </div>
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

              {invoice.onlinePaymentAvailable && invoice.status !== 'paid' && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  {paymentSuccess ? (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-center">
                      <p className="font-semibold text-base">Payment Succeeded!</p>
                      <p className="text-sm mt-1 text-emerald-700">Thank you! Your payment has been received and posted to this invoice.</p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm">Pay Invoice Online</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Secure card or bank payment processed directly.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handlePay}
                        disabled={paying}
                        className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm transition shadow-sm disabled:opacity-60 shrink-0"
                      >
                        {paying ? 'Processing Payment…' : `Pay ${invoice.currency} ${(parseFloat(invoice.total) - parseFloat(invoice.amountPaid)).toFixed(2)}`}
                      </button>
                    </div>
                  )}
                  {paymentError && (
                    <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                      {paymentError}
                    </div>
                  )}
                </div>
              )}

              {!invoice.onlinePaymentAvailable && invoice.status !== 'paid' && (
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
