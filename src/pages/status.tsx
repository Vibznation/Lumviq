import React, { useEffect, useState } from 'react'
import MarketingLayout from '../components/marketing/MarketingLayout'
import { brand } from '../lib/brand'
import type { StatusResponse } from './api/status'

const STATUS_STYLES: Record<string, string> = {
  operational: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
  degraded: 'bg-gold-100 text-gold-800 dark:bg-gold-900 dark:text-gold-300',
  down: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const STATUS_LABELS: Record<string, string> = {
  operational: 'Operational',
  degraded: 'Degraded performance',
  down: 'Down',
}

export default function StatusPage() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/status')
        if (!res.ok) throw new Error('Status check failed')
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (err: any) {
        if (!cancelled) setError('Could not reach the status service.')
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <MarketingLayout
      title="System Status"
      description={`Live operational status for ${brand.name}.`}
      path="/status"
    >
      <section className="max-w-2xl mx-auto px-4 pt-16 pb-20">
        <h1 className="text-3xl md:text-4xl font-semibold text-midnight-900 dark:text-white">System status</h1>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Live status, checked directly against our production systems. This page refreshes automatically every 30
          seconds.
        </p>

        {error && (
          <div role="alert" className="mt-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {!data && !error && <p className="mt-6 text-sm text-gray-500">Checking status…</p>}

        {data && (
          <div className="mt-6">
            <div className={'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ' + STATUS_STYLES[data.overall]}>
              {STATUS_LABELS[data.overall]}
            </div>
            <p className="mt-1 text-xs text-gray-400">Last checked {new Date(data.checkedAt).toLocaleTimeString()}</p>

            <ul className="mt-6 divide-y divide-gray-200 dark:divide-midnight-800 border-t border-b border-gray-200 dark:border-midnight-800">
              {data.components.map((c) => (
                <li key={c.name} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{c.name}</p>
                    {c.detail && <p className="text-xs text-gray-400">{c.detail}</p>}
                  </div>
                  <span className={'text-xs font-medium rounded-full px-2 py-1 ' + STATUS_STYLES[c.status]}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </MarketingLayout>
  )
}
