import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import DocumentsPanel from '../../../components/DocumentsPanel'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Account = { id: string; code: string; name: string; type: string; subtype: string }
type ReimbursementLine = { id: string; date: string; description: string; amount: string; expenseAccountId: string }
type Reimbursement = {
  id: string
  payeeName: string
  amount: string
  description: string | null
  status: string
  expenseAccountId: string
  lines: ReimbursementLine[]
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  approved: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  paid: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
}

function ReimbursementDetailContent() {
  const router = useRouter()
  const { id } = router.query
  const { token, currentOrg } = useAuth()
  const [reimbursement, setReimbursement] = useState<Reimbursement | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [lineForm, setLineForm] = useState({ date: '', description: '', amount: '', expenseAccountId: '' })

  async function load() {
    if (!id || !currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [rRes, aRes] = await Promise.all([
        fetch(`/api/reimbursements/${id}`, { headers: authHeaders(token) }),
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      const rBody = await rRes.json()
      if (!rRes.ok) throw new Error(rBody.error || 'Could not load reimbursement')
      setReimbursement(rBody)
      setAccounts(aRes.ok ? await aRes.json() : [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentOrg?.id])

  async function decide(decision: 'approve' | 'reject' | 'pay') {
    if (!reimbursement) return
    setBusy(true)
    setError(null)
    try {
      const bankAccount = accounts.find((a) => a.subtype === 'bank')
      const res = await fetch(`/api/reimbursements/${reimbursement.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ decision, paymentAccountId: decision === 'pay' ? bankAccount?.id : undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not update reimbursement')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddLine(e: React.FormEvent) {
    e.preventDefault()
    if (!reimbursement) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/reimbursements/${reimbursement.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(lineForm),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not add expense line')
      }
      setLineForm({ date: '', description: '', amount: '', expenseAccountId: '' })
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const expenseAccounts = accounts.filter((a) => a.type === 'expense')

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>
  if (error && !reimbursement) return <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
  if (!reimbursement) return null

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">{reimbursement.payeeName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className={'inline-block rounded-full px-2 py-0.5 text-xs font-medium ' + (STATUS_STYLES[reimbursement.status] || '')}>{reimbursement.status}</span>
          </p>
        </div>
        <Link href="/purchasing/reimbursements" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← All reimbursements</Link>
      </div>

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Details</h2>
          <dl className="text-sm space-y-1">
            <div><dt className="inline text-gray-500 dark:text-gray-400">Description: </dt><dd className="inline text-gray-900 dark:text-gray-100">{reimbursement.description || '—'}</dd></div>
          </dl>
        </div>
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Total</h2>
          <p className="text-2xl font-semibold text-midnight-900 dark:text-white">{currency(reimbursement.amount)}</p>
          <div className="mt-3 flex items-center gap-3">
            {reimbursement.status === 'pending' && (
              <>
                <button onClick={() => decide('approve')} disabled={busy} className="text-xs text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50">Approve</button>
                <button onClick={() => decide('reject')} disabled={busy} className="text-xs text-red-600 hover:underline disabled:opacity-50">Reject</button>
              </>
            )}
            {reimbursement.status === 'approved' && (
              <button onClick={() => decide('pay')} disabled={busy} className="text-xs text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50">Mark paid</button>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Expense lines</h2>
      {reimbursement.lines.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">No individual expense lines — using the single amount above.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {reimbursement.lines.map((l) => (
                <tr key={l.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{new Date(l.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{l.description}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reimbursement.status !== 'paid' && (
        <form onSubmit={handleAddLine} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid gap-3 max-w-md">
          <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400">Add expense line</h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Date</label>
            <input type="date" required value={lineForm.date} onChange={(e) => setLineForm((f) => ({ ...f, date: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Description</label>
            <input required value={lineForm.description} onChange={(e) => setLineForm((f) => ({ ...f, description: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Amount</label>
            <input required value={lineForm.amount} onChange={(e) => setLineForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Expense account</label>
            <select required value={lineForm.expenseAccountId} onChange={(e) => setLineForm((f) => ({ ...f, expenseAccountId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
              <option value="">Select…</option>
              {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50 w-fit">
            Add line
          </button>
        </form>
      )}

      <DocumentsPanel relatedType="reimbursement" relatedId={reimbursement.id} />
    </div>
  )
}

export default function ReimbursementDetailPage() {
  return (
    <ProtectedRoute>
      <ReimbursementDetailContent />
    </ProtectedRoute>
  )
}
