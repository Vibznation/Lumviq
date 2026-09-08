import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Approval = {
  id: string
  resourceType: string
  resourceId: string
  status: string
  amount: string | null
  note: string | null
  requestedByUserId: string
  decidedByUserId: string | null
  createdAt: string
}

/**
 * Approval Center: shows pending sign-offs on sensitive actions — bill
 * payments, reimbursement payouts, purchase order issuance, manual
 * journal entries, and payroll run posting — each gated by a configurable
 * per-organization dollar threshold (Settings → approval thresholds). See
 * src/lib/approvals.ts for the full threshold table and executor logic.
 */
function ApprovalsContent() {
  const { token, currentOrg } = useAuth()
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [deciding, setDeciding] = useState<string | null>(null)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const qs = filter === 'pending' ? '&status=pending' : ''
      const res = await fetch(`/api/approvals?organizationId=${currentOrg.id}${qs}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load approvals')
      setApprovals(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, filter])

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setDeciding(id)
    setError(null)
    try {
      const res = await fetch(`/api/approvals/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ decision }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not record decision')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeciding(null)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Approval Center</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {currentOrg?.name} — sensitive actions above a threshold wait here for sign-off before anything posts to the ledger.
      </p>

      <div className="mb-4 flex gap-2 text-sm">
        <button
          onClick={() => setFilter('pending')}
          className={`rounded-md px-3 py-1.5 ${filter === 'pending' ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-midnight-800 text-gray-700 dark:text-gray-300'}`}
        >
          Pending
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`rounded-md px-3 py-1.5 ${filter === 'all' ? 'bg-teal-600 text-white' : 'bg-gray-100 dark:bg-midnight-800 text-gray-700 dark:text-gray-300'}`}
        >
          All
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : approvals.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing to review.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Note</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100 capitalize">{a.resourceType.replace('-', ' ')}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{a.note}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{a.amount ? Number(a.amount).toFixed(2) : '—'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        'text-xs px-2 py-0.5 rounded-full ' +
                        (a.status === 'pending'
                          ? 'bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300'
                          : a.status === 'approved'
                          ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300')
                      }
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {a.status === 'pending' && (
                      <div className="flex gap-2 justify-end">
                        <button
                          disabled={deciding === a.id}
                          onClick={() => decide(a.id, 'approved')}
                          className="rounded-md bg-teal-600 text-white px-2.5 py-1 text-xs font-medium hover:bg-teal-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          disabled={deciding === a.id}
                          onClick={() => decide(a.id, 'rejected')}
                          className="rounded-md bg-gray-100 dark:bg-midnight-800 text-gray-700 dark:text-gray-300 px-2.5 py-1 text-xs font-medium hover:bg-gray-200 dark:hover:bg-midnight-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
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

export default function ApprovalsPage() {
  return (
    <ProtectedRoute>
      <ApprovalsContent />
    </ProtectedRoute>
  )
}
