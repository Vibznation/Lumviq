import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import PageHeader from '../../components/PageHeader'
import { authHeaders, useAuth } from '../../lib/auth-context'
import { resolveEntitlements, hasFeature } from '../../lib/entitlements'

type AuditEvent = { id: string; action: string; resourceType: string; resourceId: string; createdAt: string }

function AuditLogContent() {
  const { token, currentOrg } = useAuth()
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [cap, setCap] = useState<number | null>(null)
  const [unlimited, setUnlimited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resourceType, setResourceType] = useState('')

  const entitlements = currentOrg ? resolveEntitlements(currentOrg) : null
  const hasFullHistory = entitlements ? hasFeature(entitlements, 'team.audit-history') : false

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/audit-events?organizationId=${currentOrg.id}${resourceType ? `&resourceType=${resourceType}` : ''}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load audit history')
      const data = await res.json()
      setEvents(data.events)
      setCap(data.cap)
      setUnlimited(data.unlimited)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function exportCsv() {
    if (!currentOrg) return
    const res = await fetch(`/api/audit-events?organizationId=${currentOrg.id}&format=csv${resourceType ? `&resourceType=${resourceType}` : ''}`, { headers: authHeaders(token) })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.upgradeMessage || data.error || 'Could not export audit history')
      return
    }
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${currentOrg.id}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, resourceType])

  const resourceTypes = Array.from(new Set(events.map((e) => e.resourceType)))

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/settings/organization" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← Back to organization settings</Link>
      </div>
      <PageHeader
        icon="📜"
        eyebrow="Settings"
        title="Audit History"
        subtitle={`${currentOrg?.name || ''} — ${unlimited ? 'unlimited retention' : `most recent ${cap ?? 200} events`}`}
      />
      <div className="mb-6 flex justify-end gap-3">
        <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
          <option value="">All resource types</option>
          {resourceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {hasFullHistory ? (
          <button onClick={exportCsv} className="rounded-md bg-teal-700 text-white text-sm px-3 py-1.5 hover:bg-teal-800">
            Export CSV
          </button>
        ) : (
          <Link href="/pricing" title="Unlimited history and CSV export require Enterprise" className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-600 hover:underline">
            Export CSV (Enterprise)
          </Link>
        )}
      </div>

      {!hasFullHistory && (
        <div className="mb-4 text-sm text-gray-500 bg-gray-50 dark:bg-midnight-800 border border-gray-200 dark:border-midnight-700 rounded-md px-3 py-2">
          You're viewing the most recent {cap ?? 200} events. Upgrade to <Link href="/pricing" className="text-teal-700 dark:text-teal-400 hover:underline">Enterprise</Link> for unlimited retention and CSV export.
        </div>
      )}

      {error && <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}


      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500">No audit events yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Resource type</th><th className="px-4 py-2">Resource ID</th></tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{e.action}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{e.resourceType}</td>
                  <td className="px-4 py-2 text-gray-400 dark:text-gray-500 font-mono text-xs">{e.resourceId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function AuditLogPage() {
  return (
    <ProtectedRoute>
      <AuditLogContent />
    </ProtectedRoute>
  )
}
