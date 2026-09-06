import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import DocumentsPanel from '../../../components/DocumentsPanel'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Account = { id: string; code: string; name: string; subtype: string | null }
type BillLine = { id: string; description: string; quantity: string; unitPrice: string; amount: string; account: { code: string; name: string } }
type Payment = { id: string; amount: string; paymentDate: string; method: string | null }
type Bill = {
  id: string
  billNumber: string
  status: string
  issueDate: string
  dueDate: string
  subtotal: string
  taxTotal: string
  total: string
  amountPaid: string
  vendor: { name: string; email: string | null }
  lines: BillLine[]
  payments: Payment[]
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function BillDetailContent() {
  const router = useRouter()
  const { id } = router.query
  const { token, currentOrg } = useAuth()
  const [bill, setBill] = useState<Bill | null>(null)
  const [bankAccounts, setBankAccounts] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paymentAccountId, setPaymentAccountId] = useState('')

  async function load() {
    if (!id) return
    const res = await fetch(`/api/bills/${id}`, { headers: authHeaders(token) })
    if (res.ok) setBill(await res.json())
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!currentOrg) return
    fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : []))
      .then((accounts: Account[]) => {
        const banks = accounts.filter((a) => a.subtype === 'bank')
        setBankAccounts(banks)
        if (banks.length > 0) setPaymentAccountId(banks[0].id)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function handleSend() {
    if (!bill) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/bills/${bill.id}/send`, { method: 'POST', headers: authHeaders(token) })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not post bill')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleVoid() {
    if (!bill) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/bills/${bill.id}/void`, { method: 'POST', headers: authHeaders(token) })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not void bill')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!bill) return
    if (!paymentAccountId) return setError('Select a payment account')
    if (!paymentAmount) return setError('Enter a payment amount')
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/bills/${bill.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ amount: paymentAmount, paymentDate, paymentAccountId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not record payment')
      }
      if (res.status === 202) {
        setInfo('This payment amount requires approval before it will post — see Approvals.')
      } else {
        setPaymentAmount('')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!bill) return <p className="text-sm text-gray-500">Loading…</p>

  const balance = Number(bill.total) - Number(bill.amountPaid)

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">{bill.billNumber}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{bill.vendor.name}</p>
        </div>
        <Link href="/purchasing/bills" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
          Back to bills
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {info && (
        <div className="mb-4 text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-md px-3 py-2">
          {info}
        </div>
      )}

      <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-midnight-800 dark:text-gray-300">
            {bill.status.replace('_', ' ')}
          </span>
          <div className="flex gap-2">
            {bill.status === 'draft' && (
              <button onClick={handleSend} disabled={busy} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                Post bill
              </button>
            )}
            {bill.status !== 'voided' && Number(bill.amountPaid) === 0 && (
              <button onClick={handleVoid} disabled={busy} className="rounded-md border border-red-300 text-red-700 px-3 py-1.5 text-sm font-medium hover:bg-red-50 disabled:opacity-50">
                Void
              </button>
            )}
          </div>
        </div>

        <table className="w-full text-sm mb-4">
          <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
            <tr>
              <th className="py-1">Description</th>
              <th className="py-1">Account</th>
              <th className="py-1 text-right">Qty</th>
              <th className="py-1 text-right">Unit price</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 dark:border-midnight-800">
                <td className="py-1.5 text-gray-900 dark:text-gray-100">{l.description}</td>
                <td className="py-1.5 text-gray-500 dark:text-gray-400">{l.account.code} {l.account.name}</td>
                <td className="py-1.5 text-right text-gray-500 dark:text-gray-400">{l.quantity}</td>
                <td className="py-1.5 text-right text-gray-500 dark:text-gray-400">{currency(l.unitPrice)}</td>
                <td className="py-1.5 text-right text-gray-900 dark:text-gray-100">{currency(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-gray-100 dark:border-midnight-800 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Subtotal</span><span>{currency(bill.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Tax</span><span>{currency(bill.taxTotal)}</span>
          </div>
          <div className="flex justify-between font-semibold text-midnight-900 dark:text-white">
            <span>Total</span><span>{currency(bill.total)}</span>
          </div>
          <div className="flex justify-between text-gray-500 dark:text-gray-400">
            <span>Paid</span><span>{currency(bill.amountPaid)}</span>
          </div>
          <div className="flex justify-between font-semibold text-midnight-900 dark:text-white">
            <span>Balance due</span><span>{currency(balance)}</span>
          </div>
        </div>
      </div>

      {bill.payments.length > 0 && (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Payments</h2>
          <ul className="text-sm space-y-1">
            {bill.payments.map((p) => (
              <li key={p.id} className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>{new Date(p.paymentDate).toLocaleDateString()} {p.method ? `(${p.method})` : ''}</span>
                <span>{currency(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bill.status !== 'draft' && bill.status !== 'voided' && balance > 0 && (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Record a payment</h2>
          {bankAccounts.length === 0 ? (
            <p className="text-sm text-gray-500">
              No bank accounts yet — <Link href="/banking/import" className="text-teal-700 dark:text-teal-400 hover:underline">create one</Link>.
            </p>
          ) : (
            <form onSubmit={handleRecordPayment} className="grid grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Amount</label>
                <input
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Pay from</label>
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                >
                  {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <button type="submit" disabled={busy} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                  Record payment
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="mt-4">
        <DocumentsPanel relatedType="bill" relatedId={bill.id} />
      </div>
    </div>
  )
}

export default function BillDetailPage() {
  return (
    <ProtectedRoute>
      <BillDetailContent />
    </ProtectedRoute>
  )
}
