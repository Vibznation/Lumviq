import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import PageHeader from '../../components/PageHeader'
import { authHeaders, useAuth } from '../../lib/auth-context'

const DEFAULT_RATE = '0.67'

type MileageLog = {
  id: string
  date: string
  startLocation: string
  endLocation: string
  purpose: string | null
  miles: string
  ratePerMile: string
  amount: string
  reimbursementId?: string | null
}

type Account = {
  id: string
  name: string
  number: string
  type: string
}

/**
 * Mileage tracking (Lumviq Start and higher). Logs business-travel
 * mileage for tax-deduction / reimbursement purposes; Lumviq allows converting
 * un-reimbursed logs directly into multi-line Expense Reimbursements.
 */
function MileageContent() {
  const { user, token, currentOrg } = useAuth()
  const [logs, setLogs] = useState<MileageLog[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [converting, setConverting] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertForm, setConvertForm] = useState({
    payeeName: '',
    expenseAccountId: '',
  })
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    startLocation: '',
    endLocation: '',
    purpose: '',
    miles: '',
    ratePerMile: DEFAULT_RATE,
  })

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [logsRes, accountsRes] = await Promise.all([
        fetch(`/api/mileage?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!logsRes.ok) throw new Error('Could not load mileage logs')
      setLogs(await logsRes.json())
      if (accountsRes.ok) {
        const accs = await accountsRes.json()
        const expenseAccs = (Array.isArray(accs) ? accs : []).filter((a: Account) => a.type === 'expense')
        setAccounts(expenseAccs)
        if (expenseAccs.length > 0 && !convertForm.expenseAccountId) {
          setConvertForm((f) => ({ ...f, expenseAccountId: expenseAccs[0].id }))
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    if (user?.name) {
      setConvertForm((f) => ({ ...f, payeeName: user.name || '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !form.startLocation || !form.endLocation || !form.miles) return
    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)
    setUpgradeMessage(null)
    try {
      const res = await fetch('/api/mileage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...form }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 403 && body.upgradeMessage) setUpgradeMessage(body.upgradeMessage)
        throw new Error(body.error || 'Could not add mileage log')
      }
      setForm((f) => ({ ...f, startLocation: '', endLocation: '', purpose: '', miles: '' }))
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function selectAllUnreimbursed() {
    const unreimbursed = logs.filter((l) => !l.reimbursementId).map((l) => l.id)
    if (selectedIds.length === unreimbursed.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(unreimbursed)
    }
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || selectedIds.length === 0 || !convertForm.expenseAccountId) return
    setConverting(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await fetch('/api/mileage/convert-to-reimbursement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          mileageLogIds: selectedIds,
          expenseAccountId: convertForm.expenseAccountId,
          payeeName: convertForm.payeeName,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to convert mileage logs')

      setSuccessMessage(`Successfully created reimbursement #${body.reimbursement?.id?.slice(0, 8)} for ${selectedIds.length} mileage entries.`)
      setSelectedIds([])
      setShowConvertModal(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setConverting(false)
    }
  }

  const totalMiles = logs.reduce((sum, l) => sum + Number(l.miles), 0)
  const totalAmount = logs.reduce((sum, l) => sum + Number(l.amount), 0)
  const unreimbursedLogs = logs.filter((l) => !l.reimbursementId)
  const selectedAmount = logs.filter((l) => selectedIds.includes(l.id)).reduce((sum, l) => sum + Number(l.amount), 0)

  return (
    <div className="max-w-4xl">
      <PageHeader
        icon="🚗"
        eyebrow="Purchasing"
        title="Mileage Tracking"
        subtitle={`${currentOrg?.name || ''} — log business travel and convert trips to expense reimbursements.`}
      />

      {upgradeMessage && (
        <div className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {upgradeMessage}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 text-sm text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2 flex items-center justify-between">
          <span>{successMessage}</span>
          <Link href="/purchasing/reimbursements" className="underline font-medium text-emerald-900 dark:text-emerald-300 ml-2">
            View Reimbursements →
          </Link>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Date</label>
          <input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">From</label>
          <input required value={form.startLocation} onChange={(e) => setForm((f) => ({ ...f, startLocation: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">To</label>
          <input required value={form.endLocation} onChange={(e) => setForm((f) => ({ ...f, endLocation: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Purpose</label>
          <input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Miles</label>
          <input type="number" step="0.1" min="0" required value={form.miles} onChange={(e) => setForm((f) => ({ ...f, miles: e.target.value }))} className="mt-1 w-24 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Rate/mile ($)</label>
          <input type="number" step="0.001" min="0" required value={form.ratePerMile} onChange={(e) => setForm((f) => ({ ...f, ratePerMile: e.target.value }))} className="mt-1 w-24 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          Add
        </button>
      </form>

      {selectedIds.length > 0 && (
        <div className="mb-4 bg-teal-50 dark:bg-midnight-800 border border-teal-200 dark:border-teal-700/60 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-teal-900 dark:text-teal-200 font-medium">
            {selectedIds.length} trip{selectedIds.length === 1 ? '' : 's'} selected (${selectedAmount.toFixed(2)})
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs px-2.5 py-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 border border-gray-300 dark:border-midnight-600 rounded"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setShowConvertModal(true)}
              className="text-xs px-3 py-1 bg-teal-600 text-white font-medium rounded hover:bg-teal-700 shadow-sm"
            >
              Convert to Reimbursement →
            </button>
          </div>
        </div>
      )}

      {showConvertModal && (
        <div className="mb-6 bg-white dark:bg-midnight-900 border border-teal-300 dark:border-teal-700 rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Convert {selectedIds.length} trip{selectedIds.length === 1 ? '' : 's'} to Reimbursement (${selectedAmount.toFixed(2)})
          </h3>
          <form onSubmit={handleConvert} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Payee Name</label>
              <input
                required
                value={convertForm.payeeName}
                onChange={(e) => setConvertForm((f) => ({ ...f, payeeName: e.target.value }))}
                placeholder="Employee / Driver name"
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Expense Account</label>
              <select
                required
                value={convertForm.expenseAccountId}
                onChange={(e) => setConvertForm((f) => ({ ...f, expenseAccountId: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
              >
                {accounts.length === 0 && <option value="">No expense accounts found</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.number} — {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                disabled={converting || !convertForm.expenseAccountId}
                className="rounded-md bg-teal-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {converting ? 'Creating…' : 'Create Reimbursement'}
              </button>
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="rounded-md border border-gray-300 dark:border-midnight-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-midnight-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500">No mileage logged yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 w-8 text-center">
                  {unreimbursedLogs.length > 0 && (
                    <input
                      type="checkbox"
                      checked={selectedIds.length === unreimbursedLogs.length && unreimbursedLogs.length > 0}
                      onChange={selectAllUnreimbursed}
                      className="rounded text-teal-600"
                      title="Select all un-reimbursed"
                    />
                  )}
                </th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">From → To</th>
                <th className="px-3 py-2">Purpose</th>
                <th className="px-3 py-2 text-right">Miles</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const isReimbursed = !!l.reimbursementId
                const isSelected = selectedIds.includes(l.id)
                return (
                  <tr key={l.id} className={`border-t border-gray-100 dark:border-midnight-800 ${isSelected ? 'bg-teal-50/40 dark:bg-midnight-800/60' : ''}`}>
                    <td className="px-3 py-2 text-center">
                      {!isReimbursed ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(l.id)}
                          className="rounded text-teal-600"
                        />
                      ) : (
                        <span className="text-gray-300 dark:text-midnight-700 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{new Date(l.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{l.startLocation} → {l.endLocation}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{l.purpose || '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{Number(l.miles).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">${Number(l.amount).toFixed(2)}</td>
                    <td className="px-3 py-2 text-center">
                      {isReimbursed ? (
                        <Link
                          href={`/purchasing/reimbursements/${l.reimbursementId}`}
                          className="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 hover:underline"
                        >
                          Reimbursed ✓
                        </Link>
                      ) : (
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600 dark:bg-midnight-800 dark:text-gray-400">
                          Unreimbursed
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-midnight-700 font-medium">
                <td className="px-3 py-2" colSpan={4}>Total</td>
                <td className="px-3 py-2 text-right">{totalMiles.toFixed(2)}</td>
                <td className="px-3 py-2 text-right">${totalAmount.toFixed(2)}</td>
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export default function MileagePage() {
  return (
    <ProtectedRoute>
      <MileageContent />
    </ProtectedRoute>
  )
}
