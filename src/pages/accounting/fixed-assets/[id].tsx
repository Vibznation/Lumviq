import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type DepreciationEntry = { id: string; periodDate: string; amount: string }
type FixedAsset = {
  id: string
  name: string
  cost: string
  salvageValue: string
  usefulLifeMonths: number
  acquisitionDate: string
  disposedAt: string | null
  depreciationEntries: DepreciationEntry[]
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function FixedAssetDetailContent() {
  const router = useRouter()
  const { id } = router.query
  const { token } = useAuth()
  const [asset, setAsset] = useState<FixedAsset | null>(null)
  const [periodDate, setPeriodDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!id) return
    const res = await fetch(`/api/fixed-assets/${id}`, { headers: authHeaders(token) })
    if (res.ok) setAsset(await res.json())
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleDepreciate(e: React.FormEvent) {
    e.preventDefault()
    if (!asset) return
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`/api/fixed-assets/${asset.id}/depreciate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ periodDate }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not post depreciation')
      }
      const result = await res.json()
      if (result && result.message) {
        setInfo(result.message)
      } else {
        setInfo('Depreciation posted.')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!asset) return <p className="text-sm text-gray-500">Loading…</p>

  const accumulated = asset.depreciationEntries.reduce((sum, e) => sum + Number(e.amount), 0)
  const bookValue = Number(asset.cost) - accumulated

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">{asset.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Acquired {new Date(asset.acquisitionDate).toLocaleDateString()}
          </p>
        </div>
        <Link href="/accounting/fixed-assets" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
          Back to fixed assets
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
            <span className="block text-xs text-gray-500 dark:text-gray-400">Cost</span>
            <span className="font-semibold text-midnight-900 dark:text-white">{currency(asset.cost)}</span>
          </div>
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Salvage value</span>
            <span className="font-semibold text-midnight-900 dark:text-white">{currency(asset.salvageValue)}</span>
          </div>
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Accumulated depreciation</span>
            <span className="font-semibold text-midnight-900 dark:text-white">{currency(accumulated)}</span>
          </div>
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400">Book value</span>
            <span className="font-semibold text-midnight-900 dark:text-white">{currency(bookValue)}</span>
          </div>
        </div>
        {asset.disposedAt ? (
          <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
            Disposed {new Date(asset.disposedAt).toLocaleDateString()}
          </span>
        ) : (
          <form onSubmit={handleDepreciate} className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Period date</label>
              <input
                type="date"
                value={periodDate}
                onChange={(e) => setPeriodDate(e.target.value)}
                className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
              />
            </div>
            <button type="submit" disabled={busy} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              Post depreciation
            </button>
          </form>
        )}
      </div>

      <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 dark:border-midnight-800 text-xs font-medium text-gray-500 dark:text-gray-400">
          Depreciation entries
        </div>
        {asset.depreciationEntries.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">No depreciation posted yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {asset.depreciationEntries.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 dark:border-midnight-800 first:border-t-0">
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(e.periodDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function FixedAssetDetailPage() {
  return (
    <ProtectedRoute>
      <FixedAssetDetailContent />
    </ProtectedRoute>
  )
}
