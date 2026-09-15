import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Account = { id: string; code: string; name: string; type: string }
type Line = {
  id: string
  description: string | null
  amount: string
  isDebit: boolean
  journalEntryId: string
  journalEntryDescription: string | null
  postedAt: string | null
}

const CREDIT_NORMAL_TYPES = new Set(['liability', 'equity', 'income'])

function GeneralLedgerDetailContent() {
  const router = useRouter()
  const { id } = router.query
  const { token, currentOrg } = useAuth()
  const [account, setAccount] = useState<Account | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!currentOrg || !id) return
      setLoading(true)
      setError(null)
      try {
        const [accountsRes, linesRes] = await Promise.all([
          fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
          fetch(`/api/journal/lines?organizationId=${currentOrg.id}&accountId=${id}`, { headers: authHeaders(token) }),
        ])
        if (!accountsRes.ok) throw new Error('Could not load account')
        if (!linesRes.ok) throw new Error('Could not load ledger activity')
        const accounts: Account[] = await accountsRes.json()
        setAccount(accounts.find((a) => a.id === id) || null)
        setLines(await linesRes.json())
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, id])

  const creditNormal = account ? CREDIT_NORMAL_TYPES.has(account.type) : false

  let running = 0
  const rows = lines.map((l) => {
    const signed = l.isDebit ? Number(l.amount) : -Number(l.amount)
    running += signed
    const displayBalance = creditNormal ? -running : running
    return { ...l, displayBalance }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">
            {account ? `${account.code} — ${account.name}` : 'General ledger'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name} &middot; all posted activity for this account.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/accounting/general-ledger" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            ← All accounts
          </Link>
          <Link href="/accounting/journal-entries" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Journal entries
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading activity…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No posted transactions for this account yet.</p>
      ) : (
        <table className="w-full text-sm border border-gray-200 dark:border-midnight-800 rounded-md overflow-hidden">
          <thead className="bg-gray-50 dark:bg-midnight-900 text-left text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium text-right">Debit</th>
              <th className="px-3 py-2 font-medium text-right">Credit</th>
              <th className="px-3 py-2 font-medium text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 dark:border-midnight-800">
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{l.postedAt ? new Date(l.postedAt).toLocaleDateString() : '—'}</td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{l.description || l.journalEntryDescription || '—'}</td>
                <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{l.isDebit ? l.amount : ''}</td>
                <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{!l.isDebit ? l.amount : ''}</td>
                <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{l.displayBalance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function GeneralLedgerDetailPage() {
  return (
    <ProtectedRoute>
      <GeneralLedgerDetailContent />
    </ProtectedRoute>
  )
}
