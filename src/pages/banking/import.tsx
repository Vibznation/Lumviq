import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Papa from 'papaparse'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type BankAccount = { id: string; name: string }

function BankImportContent() {
  const { token, currentOrg } = useAuth()
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankAccountId, setBankAccountId] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')

  async function loadBankAccounts() {
    if (!currentOrg) return
    const res = await fetch(`/api/banking/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
    if (!res.ok) return
    const accounts: BankAccount[] = await res.json()
    setBankAccounts(accounts)
    if (accounts.length > 0 && !bankAccountId) setBankAccountId(accounts[0].id)
  }

  useEffect(() => {
    loadBankAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function createBankAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !newAccountName) return
    const res = await fetch('/api/banking/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify({ organizationId: currentOrg.id, name: newAccountName }),
    })
    if (res.ok) {
      const account = await res.json()
      setNewAccountName('')
      await loadBankAccounts()
      setBankAccountId(account.id)
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    if (!bankAccountId) return setStatus('Select or create a bank account first')
    if (!file) return setStatus('No file selected')
    const text = await file.text()
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, transform: (v: string) => (v || '').trim() })
    const rows: any[] = []
    const headerMap = (parsed.meta && parsed.meta.fields || []).reduce((acc: any, f: string) => { acc[f.toLowerCase()] = f; return acc }, {})
    for (const r of parsed.data as any[]) {
      const date = r[headerMap.transactiondate] || r[headerMap.date] || r[headerMap.transaction_date] || ''
      const amountRaw = r[headerMap.amount] || r[headerMap.value] || r[headerMap['amt']] || r['amount'] || ''
      const description = r[headerMap.description] || r[headerMap.memo] || r[headerMap.details] || ''
      const externalId = r[headerMap.externalid] || r[headerMap.reference] || r[headerMap.ref] || ''
      const amount = parseFloat((amountRaw || '').toString().replace(/[^0-9.-]/g, ''))
      if (isNaN(amount)) continue
      rows.push({ transactionDate: date, amount, description, externalId })
    }

    if (rows.length === 0) return setStatus('No parsable rows found')

    setStatus('Uploading ' + rows.length + ' transactions...')
    const payload = { organizationId: currentOrg.id, bankAccountId, transactions: rows }
    try {
      const res = await fetch('/api/banking/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const j = await res.json()
        setStatus(`Imported ${j.createdCount} transaction(s)` + (j.skippedDuplicates ? `, skipped ${j.skippedDuplicates} duplicate(s)` : ''))
      } else {
        const j = await res.json().catch(() => ({}))
        setStatus('Import failed: ' + (j.error || res.statusText))
      }
    } catch (err: any) {
      setStatus('Import error: ' + err.message)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Bank CSV Import</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{currentOrg?.name}</p>

      <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 mb-4">
        <label htmlFor="bankAccount" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Bank account</label>
        {bankAccounts.length > 0 ? (
          <select
            id="bankAccount"
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
          >
            {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        ) : (
          <p className="mt-1 text-sm text-gray-500">No bank accounts yet — create one below.</p>
        )}
        <form onSubmit={createBankAccount} className="mt-3 flex gap-2">
          <input
            type="text"
            placeholder="New bank account name"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-md border border-gray-300 dark:border-midnight-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800">
            Add
          </button>
        </form>
      </div>

      <form onSubmit={handleUpload} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
        <div className="mt-3">
          <button type="submit" className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700">
            Upload
          </button>
        </div>
      </form>
      {status && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{status}</p>}
      <p className="mt-4 text-xs text-gray-400">
        CSV headers recognized: transactionDate/date, amount/value/amt, description/memo, externalId/reference.
        Rows with an externalId matching an existing transaction are skipped to avoid duplicates.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/banking/reconcile" className="text-teal-700 dark:text-teal-400 hover:underline">
          Go to reconciliation sessions →
        </Link>
      </p>
    </div>
  )
}

export default function BankImportPage() {
  return (
    <ProtectedRoute>
      <BankImportContent />
    </ProtectedRoute>
  )
}
