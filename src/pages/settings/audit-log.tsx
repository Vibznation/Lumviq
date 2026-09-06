import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type AuditEvent = { id: string; action: string; resourceType: string; resourceId: string; createdAt: string }

function AuditLogContent() {
  const { token, currentOrg } = useAuth()
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resourceType, setResourceType] = useState('')

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/audit-events?organizationId=${currentOrg.id}${resourceType ? `&resourceType=${resourceType}` : ''}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load audit history')
      setEvents(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Audit history</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name} — most recent 200 events</p>
        </div>
        <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
          <option value="">All resource types</option>
          {resourceTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

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
