import React, { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '../lib/auth-context'
import { resolveEntitlements, hasAddOnGroup } from '../lib/entitlements'
import { ADD_ONS } from '../lib/plans'
import AppShell from './AppShell'

/**
 * Wraps a page so it requires an authenticated user (and, unless
 * `requireOrg` is false, at least one organization membership).
 * Renders the shared AppShell (sidebar + topbar) around the page content.
 *
 * `requireAddOnGroup`, when set, additionally gates the page content on
 * the current organization owning any add-on in that group (see
 * src/lib/plans.ts `AddOn.group` / src/lib/entitlements.ts). This is the
 * client-side counterpart to server-side `enforceAddOnGroup()` — it
 * exists so a user without the add-on cannot gain access to a
 * fully-functional-looking page simply by navigating to its URL
 * directly (every API call still enforces this server-side regardless;
 * this check only controls what's rendered).
 */
export default function ProtectedRoute({
  children,
  requireOrg = true,
  requireAddOnGroup,
}: {
  children: React.ReactNode
  requireOrg?: boolean
  requireAddOnGroup?: string
}) {
  const router = useRouter()
  const { token, loading, organizations, currentOrg } = useAuth()
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

  if (requireAddOnGroup && currentOrg) {
    const entitlements = resolveEntitlements({
      planId: currentOrg.planId,
      billingCycle: currentOrg.billingCycle,
      addOns: currentOrg.addOns,
    })
    if (!hasAddOnGroup(entitlements, requireAddOnGroup)) {
      const groupAddOns = ADD_ONS.filter((a) => a.group === requireAddOnGroup)
      return (
        <AppShell>
          <div className="max-w-xl mx-auto mt-12 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-8 text-center">
            <h1 className="text-lg font-semibold text-midnight-900 dark:text-white mb-2">
              This organization doesn't have Payroll yet
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Add a Payroll plan to onboard employees and contractors, run pay runs, and post them to your general
              ledger. {groupAddOns[0] ? `Starts at $${groupAddOns[0].monthlyPrice}/mo.` : ''}
            </p>
            <Link href="/pricing" className="inline-block rounded-md bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700">
              View Payroll plans
            </Link>
          </div>
        </AppShell>
      )
    }
  }

  return <AppShell>{children}</AppShell>
}

