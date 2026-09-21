import React, { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { brand } from '../lib/brand'
import { useAuth } from '../lib/auth-context'
import { resolveEntitlements, hasFeature, hasAddOn } from '../lib/entitlements'
import { getPlan } from '../lib/plans'
import CommandBar from './CommandBar'
import NotificationBell from './NotificationBell'

/**
 * `featureKey` gates on a FEATURE_CATALOG key from the org's plan.
 * `addOnIds` gates on owning any one of the listed add-ons.
 * Items with neither are always available (base features on every plan).
 */
const NAV_ITEMS: Array<{ label: string; href: string; icon: string; featureKey?: string; addOnIds?: string[] }> = [
  { label: 'Overview', href: '/dashboard', icon: '🏠' },
  { label: 'Sales', href: '/sales/invoices', icon: '💳' },
  { label: 'Purchasing', href: '/purchasing/bills', icon: '🧾', featureKey: 'expenses.bill-management' },
  { label: 'Banking', href: '/banking/import', icon: '🏦', featureKey: 'accounting.bank-reconciliation' },
  { label: 'Accounting', href: '/accounting/chart-of-accounts', icon: '⚖️' },
  { label: 'Inventory', href: '/inventory', icon: '📦', featureKey: 'inventory.product-records' },
  { label: 'Projects', href: '/projects', icon: '📁', featureKey: 'projects.time-tracking' },
  { label: 'Planning', href: '/planning', icon: '🎯', featureKey: 'planning.budgets' },
  { label: 'Payroll', href: '/payroll', icon: '👥', addOnIds: ['payroll-start', 'payroll-complete', 'payroll-complete-hr'] },
  { label: 'Reports', href: '/reports', icon: '📊' },
  { label: 'Intelligence', href: '/intelligence', icon: '✨' },
  { label: 'Approvals', href: '/approvals', icon: '✅' },
  { label: 'Data', href: '/data/import-export', icon: '🔄' },
  { label: 'Support', href: '/support', icon: '💬' },
  { label: 'Settings', href: '/settings/organization', icon: '⚙️' },
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
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-gradient-to-b from-midnight-950 via-midnight-900 to-midnight-950 border-r border-teal-900/30">
        <div className="px-5 py-5 border-b border-white/5">
          <Link href="/dashboard" className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300 text-sm">
              ✦
            </span>
            {brand.name}
          </Link>
          <p className="text-xs text-teal-100/50 mt-1 pl-9">{brand.tagline}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary">
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
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all relative ' +
                  (locked
                    ? 'text-teal-100/30 hover:bg-white/5'
                    : active
                    ? 'bg-teal-500/15 text-white shadow-sm'
                    : 'text-teal-100/70 hover:bg-white/5 hover:text-white')
                }
              >
                {active && !locked && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-teal-400 rounded-r-full" />
                )}
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {locked && (
                  <span className="text-[9px] uppercase tracking-wide font-bold text-gold-400 bg-gold-950/40 px-1.5 py-0.5 rounded">
                    Pro
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        <div className="px-4 py-4 border-t border-white/5 text-xs">
          {planName && (
            <div className="mb-3 bg-white/5 rounded-xl px-3 py-2.5">
              <span className="text-teal-100/50 text-[11px] uppercase tracking-wide">Plan</span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-semibold text-white">{planName}</span>
                <Link href="/settings/billing" className="text-teal-300 hover:text-teal-200 underline">
                  Manage
                </Link>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2.5 px-1">
            <span className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-xs font-bold shrink-0">
              {user?.email?.[0]?.toUpperCase() || '?'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-teal-50 truncate">{user?.email}</div>
              <button onClick={logout} className="text-teal-300/70 hover:text-teal-200 hover:underline">
                Sign out
              </button>
            </div>
          </div>
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
              className="text-sm border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 rounded-lg px-2.5 py-1.5"
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          <div className="flex-1 max-w-xl">
            <CommandBar />
          </div>
          <NotificationBell />
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}
