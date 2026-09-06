import React, { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { brand } from '../lib/brand'
import { useAuth } from '../lib/auth-context'
import { resolveEntitlements, hasFeature, hasAddOn } from '../lib/entitlements'
import { getPlan } from '../lib/plans'

/**
 * `featureKey` gates on a FEATURE_CATALOG key from the org's plan.
 * `addOnIds` gates on owning any one of the listed add-ons.
 * Items with neither are always available (base features on every plan).
 */
const NAV_ITEMS: Array<{ label: string; href: string; featureKey?: string; addOnIds?: string[] }> = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Sales', href: '/sales/invoices' },
  { label: 'Purchasing', href: '/purchasing/bills', featureKey: 'expenses.bill-management' },
  { label: 'Banking', href: '/banking/import', featureKey: 'accounting.bank-reconciliation' },
  { label: 'Accounting', href: '/accounting/chart-of-accounts' },
  { label: 'Inventory', href: '/inventory', featureKey: 'inventory.product-records' },
  { label: 'Projects', href: '/projects', featureKey: 'projects.time-tracking' },
  { label: 'Planning', href: '/planning', featureKey: 'planning.budgets' },
  { label: 'Payroll', href: '/payroll', addOnIds: ['payroll-start', 'payroll-complete', 'payroll-complete-hr'] },
  { label: 'Reports', href: '/reports' },
  { label: 'Intelligence', href: '/intelligence' },
  { label: 'Settings', href: '/settings/organization' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, organizations, currentOrg, setCurrentOrgId, logout } = useAuth()

  const entitlements = useMemo(() => {
    if (!currentOrg) return null
    return resolveEntitlements({
      planId: currentOrg.planId,
      billingCycle: currentOrg.billingCycle,
      addOns: currentOrg.addOns,
    })
  }, [currentOrg])

  const planName = currentOrg ? getPlan(currentOrg.planId).name : null

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-midnight-950">
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-gray-200 dark:border-midnight-800 bg-white dark:bg-midnight-900">
        <div className="px-5 py-5">
          <Link href="/dashboard" className="text-lg font-semibold text-midnight-800 dark:text-white">
            {brand.name}
          </Link>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{brand.tagline}</p>
        </div>
        <nav className="flex-1 px-2 space-y-1" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = router.pathname === item.href || router.pathname.startsWith(item.href + '/')
            const locked = entitlements
              ? Boolean(
                  (item.featureKey && !hasFeature(entitlements, item.featureKey)) ||
                    (item.addOnIds && !item.addOnIds.some((id) => hasAddOn(entitlements, id)))
                )
              : false
            return (
              <Link
                key={item.href}
                href={locked ? '/pricing' : item.href}
                aria-disabled={locked}
                title={locked ? `Upgrade your plan to unlock ${item.label}` : undefined}
                className={
                  'flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
                  (locked
                    ? 'text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-midnight-800'
                    : active
                    ? 'bg-teal-50 text-teal-700 dark:bg-midnight-800 dark:text-teal-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-midnight-800')
                }
              >
                <span>{item.label}</span>
                {locked && (
                  <span className="text-[10px] uppercase tracking-wide text-gold-700 dark:text-gold-400">
                    Upgrade
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        <div className="px-4 py-4 border-t border-gray-200 dark:border-midnight-800 text-xs text-gray-500 dark:text-gray-400">
          {planName && (
            <div className="mb-3">
              <span className="text-gray-400 dark:text-gray-500">Plan</span>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800 dark:text-gray-200">{planName}</span>
                <Link href="/settings/billing" className="text-teal-700 dark:text-teal-400 hover:underline">
                  Manage
                </Link>
              </div>
            </div>
          )}
          Signed in as
          <div className="font-medium text-gray-800 dark:text-gray-200 truncate">{user?.email}</div>
          <button
            onClick={logout}
            className="mt-2 text-teal-700 dark:text-teal-400 hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-gray-200 dark:border-midnight-800 bg-white dark:bg-midnight-900 px-4 md:px-6 py-3 flex items-center gap-4">
          {organizations.length > 0 && (
            <label className="sr-only" htmlFor="org-switcher">Organization</label>
          )}
          {organizations.length > 0 && (
            <select
              id="org-switcher"
              value={currentOrg?.id || ''}
              onChange={(e) => setCurrentOrgId(e.target.value)}
              className="text-sm border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 rounded-md px-2 py-1.5"
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          <div className="flex-1 max-w-xl">
            <input
              type="text"
              placeholder={`Ask ${brand.name}, search records or create something…`}
              className="w-full text-sm rounded-md border border-gray-300 dark:border-midnight-700 bg-gray-50 dark:bg-midnight-800 dark:text-gray-100 px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500"
              aria-label="Global command bar"
              disabled
              title="Command bar actions are on the roadmap"
            />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}
