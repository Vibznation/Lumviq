import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type BankAccount = { id: string; name: string }

function ReconcileIndexContent() {
  const { token, currentOrg } = useAuth()
  const [sessions, setSessions] = useState<any[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [status, setStatus] = useState('')

  async function fetchSessions() {
    if (!currentOrg) return
    const res = await fetch(`/api/banking/reconcile/list?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
    if (!res.ok) return
    setSessions(await res.json())
  }

  async function fetchBankAccounts() {
    if (!currentOrg) return
    const res = await fetch(`/api/banking/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
    if (!res.ok) return
    const accounts: BankAccount[] = await res.json()
    setBankAccounts(accounts)
    if (accounts.length > 0 && !bankAccountId) setBankAccountId(accounts[0].id)
  }

  useEffect(() => {
    fetchSessions()
    fetchBankAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function start() {
    if (!currentOrg) return
    if (!bankAccountId) return setStatus('Create a bank account on the Import page first')
    const startDate = new Date().toISOString().slice(0, 10)
    const endDate = startDate
    const res = await fetch('/api/banking/reconcile/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ organizationId: currentOrg.id, bankAccountId, startDate, endDate }),
    })
    if (res.ok) {
      setStatus('Session started')
      fetchSessions()
    } else {
      const j = await res.json().catch(() => ({}))
      setStatus('Failed to start: ' + (j.error || res.statusText))
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Reconciliation Sessions</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{currentOrg?.name}</p>

      <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 mb-6 flex items-end gap-3">
        <div>
          <label htmlFor="bankAccount" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Bank account</label>
          {bankAccounts.length > 0 ? (
            <select
              id="bankAccount"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            >
              {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          ) : (
            <p className="mt-1 text-sm text-gray-500">
              No bank accounts yet — <Link href="/banking/import" className="text-teal-700 dark:text-teal-400 hover:underline">create one</Link>.
            </p>
          )}
        </div>
        <button onClick={start} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
          Start new session
        </button>
      </div>

      {status && <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{status}</p>}

      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500">No reconciliation sessions yet.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/banking/reconcile/session?id=${s.id}`} className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
                Session {s.id.slice(0, 8)} &middot; {s.status}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ReconcileIndex() {
  return (
    <ProtectedRoute>
      <ReconcileIndexContent />
    </ProtectedRoute>
  )
}
