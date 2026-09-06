import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../lib/auth-context'
import AppShell from './AppShell'

/**
 * Wraps a page so it requires an authenticated user (and, unless
 * `requireOrg` is false, at least one organization membership).
 * Renders the shared AppShell (sidebar + topbar) around the page content.
 */
export default function ProtectedRoute({
  children,
  requireOrg = true,
}: {
  children: React.ReactNode
  requireOrg?: boolean
}) {
  const router = useRouter()
  const { token, loading, organizations } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!token) {
      router.replace('/login')
      return
    }
    if (requireOrg && organizations.length === 0 && router.pathname !== '/onboarding') {
      router.replace('/onboarding')
    }
  }, [loading, token, organizations, requireOrg, router])

  if (loading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }

  if (requireOrg && organizations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Redirecting to onboarding…
      </div>
    )
  }

  return <AppShell>{children}</AppShell>
}
