import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Entity = {
  organizationId: string
  name: string
  isParent: boolean
  assets: number
  liabilities: number
  equity: number
  revenue: number
  expenses: number
  netIncome: number
}

function currency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function MultiEntityContent() {
  const { token, currentOrg, organizations } = useAuth()
  const [entities, setEntities] = useState<Entity[]>([])
  const [combined, setCombined] = useState<Omit<Entity, 'organizationId' | 'name' | 'isParent'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [childOrgId, setChildOrgId] = useState('')
  const [linking, setLinking] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/orgs/consolidated?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load consolidated view')
      const data = await res.json()
      setEntities(data.entities)
      setCombined(data.combined)
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

  async function handleLink(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !childOrgId) return
    setLinking(true)
    setError(null)
    try {
      const res = await fetch('/api/orgs/link-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ parentOrganizationId: currentOrg.id, childOrganizationId: childOrgId }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not link organization')
      }
      setChildOrgId('')
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLinking(false)
    }
  }

  const linkableOrgs = organizations.filter(
    (o) => o.id !== currentOrg?.id && o.role === 'owner' && !entities.some((e) => e.organizationId === o.id)
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Multi-entity management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {currentOrg?.name} — each organization keeps its own independent ledger. Figures below are shown
            side-by-side, never merged into a single set of journal entries.
          </p>
        </div>
        <Link href="/settings/intercompany-transactions" className="text-sm text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap">
          Intercompany transactions
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleLink} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 flex items-end gap-3 max-w-lg">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Add child organization (you must own both)</label>
          <select value={childOrgId} onChange={(e) => setChildOrgId(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
            <option value="">--</option>
            {linkableOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <button type="submit" disabled={linking || !childOrgId} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          {linking ? 'Linking…' : 'Link'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2 text-right">Assets</th>
                <th className="px-4 py-2 text-right">Liabilities</th>
                <th className="px-4 py-2 text-right">Equity</th>
                <th className="px-4 py-2 text-right">Revenue</th>
                <th className="px-4 py-2 text-right">Expenses</th>
                <th className="px-4 py-2 text-right">Net income</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.organizationId} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{e.name}{e.isParent ? ' (this org)' : ''}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(e.assets)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(e.liabilities)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(e.equity)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(e.revenue)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(e.expenses)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(e.netIncome)}</td>
                </tr>
              ))}
            </tbody>
            {combined && (
              <tfoot>
                <tr className="border-t border-gray-200 dark:border-midnight-700 font-semibold">
                  <td className="px-4 py-2 text-midnight-900 dark:text-white">Combined (not a merged ledger)</td>
                  <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(combined.assets)}</td>
                  <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(combined.liabilities)}</td>
                  <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(combined.equity)}</td>
                  <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(combined.revenue)}</td>
                  <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(combined.expenses)}</td>
                  <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(combined.netIncome)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

export default function MultiEntityPage() {
  return (
    <ProtectedRoute>
      <MultiEntityContent />
    </ProtectedRoute>
  )
}
