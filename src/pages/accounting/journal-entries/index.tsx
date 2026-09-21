import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import PageHeader from '../../../components/PageHeader'
import { authHeaders, useAuth } from '../../../lib/auth-context'

type Account = { id: string; code: string; name: string; type: string }

type EntryLine = {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  description: string | null
  amount: string
  isDebit: boolean
}

type Entry = {
  id: string
  description: string | null
  postedAt: string | null
  lines: EntryLine[]
}

type DraftLine = { accountId: string; description: string; debit: string; credit: string }

function emptyLine(): DraftLine {
  return { accountId: '', description: '', debit: '', credit: '' }
}

function entryTotal(entry: Entry) {
  return entry.lines.reduce((sum, l) => sum + (l.isDebit ? Number(l.amount) : 0), 0)
}

function JournalEntriesContent() {
  const { token, currentOrg } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()])
  const [submitting, setSubmitting] = useState(false)

  async function loadAccounts() {
    if (!currentOrg) return
    const res = await fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
    if (res.ok) setAccounts(await res.json())
  }

  async function loadEntries() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/journal/entries?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load journal entries')
      setEntries(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
    loadEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0)
  const isBalanced = lines.some((l) => l.accountId && (l.debit || l.credit)) && Math.abs(totalDebit - totalCredit) < 0.005

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setError(null)
    setNotice(null)

    const payloadLines = lines
      .filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0))
      .map((l) => {
        const isDebit = parseFloat(l.debit) > 0
        return {
          accountId: l.accountId,
          description: l.description || undefined,
          amount: (isDebit ? l.debit : l.credit).toString(),
          isDebit,
        }
      })

    if (payloadLines.length < 2) {
      setError('A journal entry needs at least two lines.')
      return
    }
    if (!isBalanced) {
      setError('Total debits must equal total credits before posting.')
      return
    }

    setSubmitting(true)
    try {
      const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `je-${Date.now()}-${Math.random()}`
      const res = await fetch('/api/ledger/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          description: description || undefined,
          idempotencyKey,
          lines: payloadLines,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 202) {
        setNotice('This entry exceeds your approval threshold and has been submitted for approval before it will post.')
        setShowForm(false)
        setDescription('')
        setLines([emptyLine(), emptyLine()])
        return
      }
      if (!res.ok) throw new Error(body.error || 'Could not post journal entry')
      setNotice('Journal entry posted.')
      setShowForm(false)
      setDescription('')
      setLines([emptyLine(), emptyLine()])
      await loadEntries()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon="📒"
        eyebrow="Accounting"
        title="Journal Entries"
        subtitle={`${currentOrg?.name || ''} · create and review manual, balanced double-entry postings.`}
        quickLinks={[
          { label: 'General Ledger', href: '/accounting/general-ledger', icon: '📚' },
          { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', icon: '⚖️' },
          { label: 'Close Checklist', href: '/accounting/close-checklist', icon: '✅' },
        ]}
      />
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-xl bg-teal-600 text-white px-3.5 py-2 text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Journal Entry'}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mb-4 text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-md px-3 py-2">
          {notice}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
          <div className="mb-4">
            <label htmlFor="je-description" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Description</label>
            <input
              id="je-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
              placeholder="e.g. Record monthly rent expense"
            />
          </div>

          <table className="w-full text-sm mb-3">
            <thead className="text-left text-gray-500 dark:text-gray-400">
              <tr>
                <th className="font-medium pb-1">Account</th>
                <th className="font-medium pb-1">Line description</th>
                <th className="font-medium pb-1 text-right">Debit</th>
                <th className="font-medium pb-1 text-right">Credit</th>
                <th className="pb-1" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="py-1.5 pr-2">
                    <select
                      value={line.accountId}
                      onChange={(e) => updateLine(i, { accountId: e.target.value })}
                      className="w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1 text-sm"
                    >
                      <option value="">Select account…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      value={line.description}
                      onChange={(e) => updateLine(i, { description: e.target.value })}
                      className="w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debit}
                      onChange={(e) => updateLine(i, { debit: e.target.value, credit: e.target.value ? '' : line.credit })}
                      className="w-24 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1 text-sm text-right"
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.credit}
                      onChange={(e) => updateLine(i, { credit: e.target.value, debit: e.target.value ? '' : line.debit })}
                      className="w-24 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1 text-sm text-right"
                    />
                  </td>
                  <td className="py-1.5 text-right">
                    <button type="button" onClick={() => removeLine(i)} className="text-xs text-gray-400 hover:text-red-600">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-midnight-800 font-medium">
                <td className="py-1.5" colSpan={2}>Totals</td>
                <td className="py-1.5 text-right">{totalDebit.toFixed(2)}</td>
                <td className="py-1.5 text-right">{totalCredit.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>

          <div className="flex items-center justify-between">
            <button type="button" onClick={addLine} className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
              + Add line
            </button>
            <div className="flex items-center gap-3">
              <span className={`text-xs ${isBalanced ? 'text-teal-700 dark:text-teal-400' : 'text-red-600'}`}>
                {isBalanced ? 'Balanced' : `Out of balance by ${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
              </span>
              <button
                type="submit"
                disabled={submitting || !isBalanced}
                className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
              >
                {submitting ? 'Posting…' : 'Post entry'}
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading entries…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500">No journal entries posted yet.</p>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-midnight-800 flex items-center justify-between">
                <span className="text-sm text-gray-900 dark:text-gray-100">{entry.description || 'Journal entry'}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {entry.postedAt ? new Date(entry.postedAt).toLocaleDateString() : ''} &middot; {entryTotal(entry).toFixed(2)}
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {entry.lines.map((line) => (
                    <tr key={line.id} className="border-t border-gray-100 dark:border-midnight-800 first:border-t-0">
                      <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400">{line.accountCode} — {line.accountName}</td>
                      <td className="px-4 py-1.5 text-gray-500 dark:text-gray-400">{line.description || '—'}</td>
                      <td className="px-4 py-1.5 text-right text-gray-900 dark:text-gray-100">{line.isDebit ? line.amount : ''}</td>
                      <td className="px-4 py-1.5 text-right text-gray-900 dark:text-gray-100">{!line.isDebit ? line.amount : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function JournalEntriesPage() {
  return (
    <ProtectedRoute>
      <JournalEntriesContent />
    </ProtectedRoute>
  )
}
