import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

interface PortalInfo {
  vendor: { name: string }
  organization: { name: string }
}

export default function VendorUploadPortalPage() {
  const router = useRouter()
  const { token } = router.query
  const [info, setInfo] = useState<PortalInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    fetch(`/api/portal/vendor-uploads/${token}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Failed to load this link')
        setInfo(body)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1] || '')
      reader.onerror = reject
      reader.readAsDataURL(f)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!file) {
      setSubmitError('Please choose a file to upload')
      return
    }
    setSubmitting(true)
    try {
      const base64Data = await fileToBase64(file)
      const res = await fetch(`/api/portal/vendor-uploads/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', base64Data, notes }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Upload failed')
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Head>
        <title>Bill upload</title>
      </Head>
      <div className="min-h-screen bg-slate-50 flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-lg bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          {loading && <p className="text-slate-500">Loading...</p>}
          {error && <p className="text-red-600">{error}</p>}
          {info && !submitted && (
            <>
              <h1 className="text-xl font-semibold text-slate-900 mb-1">{info.organization.name}</h1>
              <p className="text-sm text-slate-500 mb-6">Upload a bill or receipt as {info.vendor.name}</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">File</label>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-md bg-slate-900 text-white text-sm font-medium py-2 disabled:opacity-50"
                >
                  {submitting ? 'Uploading...' : 'Upload'}
                </button>
              </form>
            </>
          )}
          {submitted && (
            <div className="text-center py-8">
              <p className="text-lg font-medium text-slate-900">Thank you</p>
              <p className="text-sm text-slate-500 mt-1">Your upload was received.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
