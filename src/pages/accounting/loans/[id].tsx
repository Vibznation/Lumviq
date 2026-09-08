import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type LoanPayment = {
  id: string
  paymentDate: string
  payment: string
  principalPortion: string
  interestPortion: string
}

type Loan = {
  id: string
  name: string
  lenderName: string | null
  principal: string
  interestRatePercent: string
  termMonths: number
  startDate: string
  payments: LoanPayment[]
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function LoanDetailContent() {
  const router = useRouter()
  const { id } = router.query
  const { token } = useAuth()
  const [loan, setLoan] = useState<Loan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!id) return
    const res = await fetch(`/api/loans/${id}`, { headers: authHeaders(token) })
    if (res.ok) setLoan(await res.json())
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handlePay() {
    if (!loan) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/loans/${loan.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not post payment')
      }
      const result = await res.json()
      if (result && result.message) {
        setInfo(result.message)
      } else {
        setInfo('Payment posted.')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!loan) return <p className="text-sm text-gray-500">Loading…</p>

  const remainingBalance =
    Number(loan.principal) - loan.payments.reduce((sum, p) => sum + Number(p.principalPortion), 0)
  const fullyPaid = loan.payments.length >= loan.termMonths

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">{loan.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loan.lenderName ? `${loan.lenderName} · ` : ''}Started {new Date(loan.startDate).toLocaleDateString()}
          </p>
        </div>
        <Link href="/accounting/loans" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
          Back to loans
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-4 text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-3 py-2">{info}</div>
      )}

      <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5 mb-4">
        <div className="grid grid-cols-4 gap-3 text-sm mb-4">
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Principal</span>
            <span className="font-semibold text-midnight-900 dark:text-white">{currency(loan.principal)}</span>
          </div>
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Interest rate</span>
            <span className="font-semibold text-midnight-900 dark:text-white">{Number(loan.interestRatePercent).toFixed(2)}%</span>
          </div>
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Term</span>
            <span className="font-semibold text-midnight-900 dark:text-white">{loan.termMonths} mo</span>
          </div>
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Remaining balance</span>
            <span className="font-semibold text-midnight-900 dark:text-white">{currency(remainingBalance)}</span>
          </div>
        </div>
        {fullyPaid ? (
          <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
            Fully paid off
          </span>
        ) : (
          <button
            onClick={handlePay}
            disabled={busy}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            Post next payment
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 dark:border-midnight-800 text-xs font-medium text-gray-500 dark:text-gray-400">
          Payments ({loan.payments.length} / {loan.termMonths})
        </div>
        {loan.payments.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">No payments posted yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-1.5">Date</th>
                <th className="px-4 py-1.5 text-right">Principal</th>
                <th className="px-4 py-1.5 text-right">Interest</th>
                <th className="px-4 py-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {loan.payments.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400">{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td className="px-4 py-1.5 text-right text-gray-900 dark:text-gray-100">{currency(p.principalPortion)}</td>
                  <td className="px-4 py-1.5 text-right text-gray-900 dark:text-gray-100">{currency(p.interestPortion)}</td>
                  <td className="px-4 py-1.5 text-right text-gray-900 dark:text-gray-100">{currency(p.payment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function LoanDetailPage() {
  return (
    <ProtectedRoute>
      <LoanDetailContent />
    </ProtectedRoute>
  )
}
