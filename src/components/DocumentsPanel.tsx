import React, { useEffect, useState } from 'react'
import { authHeaders, useAuth } from '../lib/auth-context'

type Document = {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

/**
 * Attach/list files against a specific record (bill, invoice, expense,
 * etc.) via relatedType/relatedId. Uses base64-JSON upload (10MB limit) —
 * see src/lib/documents.ts for the storage implementation and trade-offs.
 */
export default function DocumentsPanel({ relatedType, relatedId }: { relatedType: string; relatedId: string }) {
  const { token, currentOrg } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!currentOrg) return
    const res = await fetch(
      `/api/documents?organizationId=${currentOrg.id}&relatedType=${relatedType}&relatedId=${relatedId}`,
      { headers: authHeaders(token) }
    )
    if (res.ok) setDocuments(await res.json())
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, relatedId])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !currentOrg) return
    if (file.size > 10 * 1024 * 1024) {
      setError('File is larger than the 10MB limit')
      return
    }
    setUploading(true)
    setError(null)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64Data = String(reader.result || '').split(',')[1]
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
          body: JSON.stringify({
            organizationId: currentOrg.id,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64Data,
            relatedType,
            relatedId,
          }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed')
        await load()
      } catch (err: any) {
        setError(err.message)
      } finally {
        setUploading(false)
        e.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  async function remove(id: string) {
    await fetch(`/api/documents/${id}`, { method: 'DELETE', headers: authHeaders(token) })
    await load()
  }

  async function download(doc: Document) {
    const res = await fetch(`/api/documents/${doc.id}`, { headers: authHeaders(token) })
    if (!res.ok) {
      setError('Could not download file')
      return
    }
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = doc.fileName
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Attachments</h3>
        <label className="text-xs text-teal-700 dark:text-teal-400 hover:underline cursor-pointer">
          {uploading ? 'Uploading…' : '+ Add file'}
          <input type="file" onChange={handleFile} disabled={uploading} className="hidden" />
        </label>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {documents.length === 0 ? (
        <p className="text-xs text-gray-500">No files attached.</p>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => download(d)}
                className="text-teal-700 dark:text-teal-400 hover:underline truncate text-left"
              >
                {d.fileName}
              </button>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs text-gray-400">{(d.sizeBytes / 1024).toFixed(0)} KB</span>
                <button onClick={() => remove(d.id)} className="text-xs text-red-600 hover:underline">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
