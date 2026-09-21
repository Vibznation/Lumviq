import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import PageHeader from '../../components/PageHeader'
import { authHeaders, useAuth } from '../../lib/auth-context'

function BrandingContent() {
  const { token, currentOrg } = useAuth()
  const [logoUrl, setLogoUrl] = useState('')
  const [brandColor, setBrandColor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!currentOrg) return
    setLoading(true)
    fetch(`/api/settings/branding?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: { logoUrl?: string | null; brandColor?: string | null }) => {
        setLogoUrl(data.logoUrl || '')
        setBrandColor(data.brandColor || '')
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setSubmitting(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/settings/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, logoUrl: logoUrl || null, brandColor: brandColor || null }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not save branding')
      }
      setSaved(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md">
      <PageHeader icon="🎨" eyebrow="Settings" title="Branding" subtitle="Shown on invoice PDFs and the customer payment portal." />
      <Link href="/settings/organization" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">← Back to organization settings</Link>

      {error && (
        <div role="alert" className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {saved && (
        <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          Branding saved.
        </div>
      )}

      {!loading && (
        <form onSubmit={handleSave} className="mt-4 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid gap-3">
          <div>
            <label htmlFor="logoUrl" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Logo URL</label>
            <input
              id="logoUrl"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…/logo.png"
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="brandColor" className="block text-xs font-medium text-gray-600 dark:text-gray-400">Brand color</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="brandColor"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder="#0f766e"
                className="w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
              />
              {brandColor && /^#[0-9a-fA-F]{6}$/.test(brandColor) && (
                <span className="inline-block w-6 h-6 rounded border border-gray-300 dark:border-midnight-700" style={{ backgroundColor: brandColor }} />
              )}
            </div>
          </div>
          <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save branding'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function BrandingPage() {
  return (
    <ProtectedRoute>
      <BrandingContent />
    </ProtectedRoute>
  )
}
