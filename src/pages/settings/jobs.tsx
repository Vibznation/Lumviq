import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import PageHeader from '../../components/PageHeader'
import { authHeaders, useAuth } from '../../lib/auth-context'

type BackgroundJob = {
  id: string
  type: string
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  attempts: number
  maxAttempts: number
  lastError: string | null
  runAt: string
  createdAt: string
  payload?: any
}

type Stats = {
  pending: number
  processing: number
  succeeded: number
  failed: number
}

function JobsContent() {
  const { token, currentOrg } = useAuth()
  const [jobs, setJobs] = useState<BackgroundJob[]>([])
  const [stats, setStats] = useState<Stats>({ pending: 0, processing: 0, succeeded: 0, failed: 0 })
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const url = filter === 'all'
        ? `/api/jobs?organizationId=${currentOrg.id}`
        : `/api/jobs?organizationId=${currentOrg.id}&status=${filter}`
      const res = await fetch(url, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load background jobs')
      const data = await res.json()
      setJobs(data.jobs || [])
      if (data.stats) setStats(data.stats)
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

  async function handleProcessNow() {
    setProcessing(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/jobs/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to process jobs')
      setMessage(`Processed ${data.processed || 0} job${data.processed === 1 ? '' : 's'}.`)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleRetry(id: string) {
    try {
      const res = await fetch(`/api/jobs/${id}/retry`, {
        method: 'POST',
        headers: authHeaders(token),
      })
      if (!res.ok) throw new Error('Could not re-queue job')
      setMessage(`Job #${id.slice(0, 8)} re-queued for execution.`)
      await load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        icon="⚙️"
        eyebrow="Settings"
        title="Background Jobs"
        subtitle={`${currentOrg?.name || ''} — inspect and dispatch queued asynchronous tasks (webhook delivery, email, recurring tasks).`}
      />

      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Link href="/settings/webhooks" className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
            ← Outbound Webhooks
          </Link>
          <span className="text-xs text-gray-400">|</span>
          <Link href="/settings/organization" className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
            Organization Settings
          </Link>
        </div>
        <button
          type="button"
          onClick={handleProcessNow}
          disabled={processing}
          className="rounded-md bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-1.5 text-xs font-medium shadow-sm transition disabled:opacity-50"
        >
          {processing ? 'Processing Queue…' : '⚡ Process Due Jobs Now'}
        </button>
      </div>

      {message && (
        <div className="mb-4 text-sm text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">Pending</span>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
        </div>
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">Processing</span>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.processing}</p>
        </div>
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">Succeeded</span>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.succeeded}</p>
        </div>
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">Failed</span>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-3">
        {['all', 'pending', 'succeeded', 'failed'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilter(st)}
            className={`text-xs px-3 py-1 rounded-md font-medium capitalize transition ${
              filter === st
                ? 'bg-teal-600 text-white'
                : 'bg-white dark:bg-midnight-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-midnight-800 hover:bg-gray-50'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-6 text-center text-sm text-gray-500">
          No background jobs in this view.
        </div>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">Job ID / Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-center">Attempts</th>
                <th className="px-3 py-2">Scheduled / Created</th>
                <th className="px-3 py-2">Error / Details</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-3 py-2">
                    <p className="font-mono text-xs text-gray-900 dark:text-gray-100">{job.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{job.type}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                        job.status === 'succeeded'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : job.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
                          : job.status === 'processing'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-gray-700 dark:text-gray-300">
                    {job.attempts} / {job.maxAttempts}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                    <p>Run: {new Date(job.runAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                    <p className="text-gray-400 dark:text-gray-500">{new Date(job.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {job.lastError ? (
                      <span className="text-red-600 dark:text-red-400 font-mono" title={job.lastError}>
                        {job.lastError}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {job.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetry(job.id)}
                        className="text-xs px-2.5 py-1 rounded bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-100 font-medium"
                      >
                        Retry
                      </button>
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

export default function JobsPage() {
  return (
    <ProtectedRoute>
      <JobsContent />
    </ProtectedRoute>
  )
}
