import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type ImportEntity = 'customers' | 'vendors' | 'accounts'
type ImportJob = {
  id: string
  entityType: string
  status: string
  dryRun: boolean
  fileName: string | null
  totalRows: number
  successRows: number
  errorRows: number
  createdAt: string
}

const ENTITIES: { value: ImportEntity; label: string }[] = [
  { value: 'customers', label: 'Customers' },
  { value: 'vendors', label: 'Vendors' },
  { value: 'accounts', label: 'Chart of accounts' },
]

/**
 * Data Import/Export center. Supports customers, vendors and chart of
 * accounts via CSV with a mandatory dry-run preview before committing.
 * Invoices, bills, bank transactions and opening balances are not yet
 * supported by this generic importer (bank CSV import is separate — see
 * /banking/import). See docs/known-limitations.md for the exact scope
 * boundary and why "rollback" only applies to dry-run previews.
 */
function ImportExportContent() {
  const { token, currentOrg } = useAuth()
  const [entity, setEntity] = useState<ImportEntity>('customers')
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<any[] | null>(null)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [jobs, setJobs] = useState<ImportJob[]>([])

  async function loadJobs() {
    if (!currentOrg) return
    const res = await fetch(`/api/import/jobs?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
    if (res.ok) setJobs(await res.json())
  }

  useEffect(() => {
    loadJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setCsvText(String(reader.result || ''))
    reader.readAsText(file)
  }

  async function runDryRun() {
    if (!currentOrg || !csvText) return
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/import/${entity}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, csvText, dryRun: true, fileName }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Preview failed')
      setPreview(json.preview)
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function commit() {
    if (!currentOrg || !csvText) return
    setCommitting(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/import/${entity}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, csvText, dryRun: false, fileName }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Import failed')
      setMessage(`Imported ${json.result.successCount} row(s), ${json.result.errorCount} error(s).`)
      setPreview(null)
      setCsvText('')
      setFileName(null)
      await loadJobs()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCommitting(false)
    }
  }

  function downloadExport(exportEntity: ImportEntity) {
    if (!currentOrg) return
    window.open(`/api/export/${exportEntity}?organizationId=${currentOrg.id}`, '_blank')
  }

  function downloadTemplate(templateEntity: ImportEntity) {
    window.open(`/api/import/template/${templateEntity}`, '_blank')
  }

  const errorCount = preview ? preview.filter((r) => !r.ok).length : 0

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Import &amp; export</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{currentOrg?.name}</p>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-4 text-sm text-teal-800 bg-teal-50 border border-teal-200 rounded-md px-3 py-2">{message}</div>
      )}

      <section className="mb-8 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Import</h2>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <select
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value as ImportEntity)
              setPreview(null)
            }}
            className="rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
          >
            {ENTITIES.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
          <button onClick={() => downloadTemplate(entity)} className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
            Download CSV template
          </button>
        </div>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm mb-3" />
        {fileName && <p className="text-xs text-gray-500 mb-3">Selected: {fileName}</p>}
        <div className="flex gap-2">
          <button
            onClick={runDryRun}
            disabled={!csvText}
            className="rounded-md bg-gray-100 dark:bg-midnight-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-200 dark:hover:bg-midnight-700 disabled:opacity-50"
          >
            Preview (dry-run)
          </button>
          <button
            onClick={commit}
            disabled={!preview || errorCount === preview.length || committing}
            className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
          >
            {committing ? 'Importing…' : 'Commit import'}
          </button>
        </div>

        {preview && (
          <div className="mt-4 text-sm">
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {preview.length - errorCount} valid row(s), {errorCount} error(s) out of {preview.length}.
            </p>
            <ul className="max-h-56 overflow-auto border border-gray-100 dark:border-midnight-800 rounded-md divide-y divide-gray-100 dark:divide-midnight-800">
              {preview.map((r: any) => (
                <li key={r.row} className={`px-3 py-1.5 text-xs ${r.ok ? 'text-gray-600 dark:text-gray-400' : 'text-red-700 dark:text-red-400'}`}>
                  Row {r.row}: {r.ok ? 'OK' : r.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mb-8 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Export</h2>
        <div className="flex gap-3 flex-wrap">
          {ENTITIES.map((e) => (
            <button
              key={e.value}
              onClick={() => downloadExport(e.value)}
              className="rounded-md bg-gray-100 dark:bg-midnight-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-200 dark:hover:bg-midnight-700"
            >
              Export {e.label} CSV
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Import history</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-gray-500">No imports yet.</p>
        ) : (
          <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2">Entity</th>
                  <th className="px-4 py-2">File</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Rows</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t border-gray-100 dark:border-midnight-800">
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100 capitalize">{j.entityType}{j.dryRun ? ' (preview)' : ''}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{j.fileName || '—'}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{j.status}</td>
                    <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{j.successRows}/{j.totalRows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default function ImportExportPage() {
  return (
    <ProtectedRoute>
      <ImportExportContent />
    </ProtectedRoute>
  )
}
