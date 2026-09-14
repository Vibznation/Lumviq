import React, { useEffect, useRef } from 'react'
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
  // Guards against calling router.replace more than once for the same
  // redirect decision. Without this, React 18 StrictMode's dev-only
  // double-invocation of effects (and rapid re-renders while auth state
  // settles) can fire router.replace twice in a row, which makes Next.js
  // abort the first in-flight navigation and log a benign but noisy
  // "Abort fetching component for route" error.
  const redirectingRef = useRef(false)

  useEffect(() => {
    if (loading) return
    if (!token) {
      if (!redirectingRef.current) {
        redirectingRef.current = true
        router.replace('/login')
      }
      return
    }
    if (requireOrg && organizations.length === 0 && router.pathname !== '/onboarding') {
      if (!redirectingRef.current) {
        redirectingRef.current = true
        router.replace('/onboarding')
      }
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
