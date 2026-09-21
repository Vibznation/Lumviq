import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import { authHeaders, useAuth } from '../lib/auth-context'
import { resolveEntitlements, hasFeature, hasAddOn } from '../lib/entitlements'
import { getPlan } from '../lib/plans'

type Summary = {
  cash: number
  revenue: number
  expenses: number
  netIncome: number
  accountCount: number
  journalEntryCount: number
  openPeriods: number
  accountsReceivable: number
  accountsPayable: number
}

function currency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function DashboardContent() {
  const { token, currentOrg } = useAuth()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const entitlements = useMemo(() => {
    if (!currentOrg) return null
    return resolveEntitlements({
      planId: currentOrg.planId,
      billingCycle: currentOrg.billingCycle,
      addOns: currentOrg.addOns,
    })
  }, [currentOrg])

  const planName = currentOrg ? getPlan(currentOrg.planId).name : null
  const hasPayroll = entitlements
    ? ['payroll-start', 'payroll-complete', 'payroll-complete-hr'].some((id) => hasAddOn(entitlements, id))
    : false

  useEffect(() => {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    fetch(`/api/reports/summary?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load overview')
        setSummary(await res.json())
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [currentOrg?.id, token])

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Greeting */}
      <div className="bg-gradient-to-r from-teal-900 via-midnight-900 to-midnight-950 text-white rounded-2xl p-6 md:p-8 shadow-sm border border-teal-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              Financial Dashboard
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {currentOrg ? currentOrg.name : 'Workspace Overview'}
            </h1>
            <p className="text-sm text-teal-100/80 mt-1 max-w-xl">
              Real-time balance sheet health, cash velocity, invoice collections, and unified ledger controls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {planName && (
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2 text-right">
                <span className="text-[11px] uppercase tracking-wider text-teal-200/80 block font-medium">Plan</span>
                <span className="font-semibold text-sm text-white">{planName}</span>
                <Link href="/settings/billing" className="block text-xs text-teal-300 hover:text-teal-200 underline mt-0.5">
                  Manage plan
                </Link>
              </div>
            )}
            <Link
              href="/sales/invoices/new"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-midnight-950 font-semibold text-sm shadow transition-all"
            >
              + New Invoice
            </Link>
            <Link
              href="/purchasing/bills/new"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 transition-all"
            >
              + New Bill
            </Link>
          </div>
        </div>

        {/* Quick actions strip */}
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Link
            href="/banking/import"
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-teal-100 font-medium"
          >
            <span>🏦</span>
            <span>Import Bank Feed</span>
          </Link>
          <Link
            href="/accounting/journal-entries"
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-teal-100 font-medium"
          >
            <span>⚖️</span>
            <span>Journal Entries</span>
          </Link>
          <Link
            href="/reports"
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-teal-100 font-medium"
          >
            <span>📊</span>
            <span>Financial Reports</span>
          </Link>
          <Link
            href="/intelligence"
            className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-teal-100 font-medium"
          >
            <span>✨</span>
            <span>AI Insights & Chat</span>
          </Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-4 text-sm text-red-700 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-midnight-900 rounded-xl animate-pulse border border-gray-200 dark:border-midnight-800" />
          ))}
        </div>
      ) : summary ? (
        <>
          {/* Top KPI Metrics Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Key Financial Metrics
              </h2>
              <Link href="/reports" className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline">
                View detailed statements →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <MetricCard
                icon="💵"
                label="Cash Position"
                value={currency(summary.cash)}
                subtitle="All active bank & cash accounts"
                href="/accounting/chart-of-accounts"
              />
              <MetricCard
                icon="📈"
                label="Total Revenue"
                value={currency(summary.revenue)}
                subtitle="Operating & sales income"
                href="/sales/invoices"
                tone="positive"
              />
              <MetricCard
                icon="📉"
                label="Expenses"
                value={currency(summary.expenses)}
                subtitle="COGS & operating expenses"
                href="/purchasing/bills"
              />
              <MetricCard
                icon="💎"
                label="Net Income"
                value={currency(summary.netIncome)}
                subtitle="Bottom-line net profitability"
                href="/reports"
                tone={summary.netIncome >= 0 ? 'positive' : 'negative'}
              />
              <MetricCard
                icon="📥"
                label="Accounts Receivable"
                value={currency(summary.accountsReceivable)}
                subtitle="Awaiting client payment"
                href="/sales/invoices"
              />
              <MetricCard
                icon="📤"
                label="Accounts Payable"
                value={currency(summary.accountsPayable)}
                subtitle="Outstanding vendor bills"
                href="/purchasing/bills"
              />
            </div>
          </div>

          {/* Ledger Pulse & Cash Liquidity Indicator */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-lg bg-teal-50 dark:bg-midnight-800 text-teal-700 dark:text-teal-400 text-sm">
                    ⚡
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-midnight-900 dark:text-white">Ledger Status & Audit Health</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Double-entry accounting posture and open reconciliation periods</p>
                  </div>
                </div>
                <Link href="/accounting/chart-of-accounts" className="text-xs text-teal-700 dark:text-teal-400 hover:underline font-medium">
                  Chart of accounts →
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center py-3 bg-gray-50 dark:bg-midnight-950/60 rounded-xl border border-gray-100 dark:border-midnight-800">
                <div>
                  <div className="text-xl font-bold text-midnight-900 dark:text-white">{summary.accountCount}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Active Accounts</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-teal-600 dark:text-teal-400">{summary.journalEntryCount}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Posted Journal Entries</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-midnight-900 dark:text-white">{summary.openPeriods}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Open Fiscal Periods</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-midnight-800">
                <span>All balanced journal lines post in real-time</span>
                <Link href="/accounting/close-checklist" className="text-teal-700 dark:text-teal-400 hover:underline font-medium">
                  Period close checklist →
                </Link>
              </div>
            </div>

            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="p-2 rounded-lg bg-teal-50 dark:bg-midnight-800 text-teal-700 dark:text-teal-400 text-sm">
                    🧭
                  </span>
                  <h3 className="text-sm font-semibold text-midnight-900 dark:text-white">Cash Liquidity Ratio</h3>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Total liquid cash available compared to immediate accounts payable obligations.
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-gray-600 dark:text-gray-300">Coverage Ratio</span>
                    <span className="text-teal-700 dark:text-teal-400 font-bold">
                      {summary.accountsPayable > 0
                        ? `${(summary.cash / summary.accountsPayable).toFixed(2)}x`
                        : '100% Free'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-midnight-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          summary.accountsPayable > 0 ? (summary.cash / (summary.cash + summary.accountsPayable)) * 100 : 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <Link
                href="/accounting/reconcile-account"
                className="mt-4 inline-flex items-center justify-center w-full py-2 px-3 text-xs font-medium rounded-lg bg-teal-50 dark:bg-midnight-800 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-midnight-700 transition"
              >
                Account Reconciliations →
              </Link>
            </div>
          </div>

          {/* Functional Navigation Modules */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Sales & Invoicing */}
            <ModuleSection
              icon="💳"
              title="Sales & Invoicing"
              description="Manage customers, issue quotes & invoices, and track payments."
              links={[
                { label: 'Invoices', href: '/sales/invoices' },
                { label: 'Customers', href: '/sales/customers' },
                { label: 'Estimates', href: '/sales/estimates', locked: entitlements ? !hasFeature(entitlements, 'sales.estimates') : false },
                { label: 'Recurring', href: '/sales/recurring', locked: entitlements ? !hasFeature(entitlements, 'sales.recurring-invoices') : false },
              ]}
            />

            {/* Purchasing & Bills */}
            <ModuleSection
              icon="🧾"
              title="Purchasing & Expenses"
              description="Record bills, issue POs, track vendor credits, mileage & reimbursements."
              links={[
                { label: 'Bills', href: '/purchasing/bills', locked: entitlements ? !hasFeature(entitlements, 'expenses.bill-management') : false },
                { label: 'Vendors', href: '/purchasing/vendors' },
                { label: 'Purchase Orders', href: '/purchasing/purchase-orders', locked: entitlements ? !hasFeature(entitlements, 'expenses.purchase-orders') : false },
                { label: 'Reimbursements', href: '/purchasing/reimbursements', locked: entitlements ? !hasFeature(entitlements, 'expenses.expense-reimbursements') : false },
                { label: 'Vendor Credits', href: '/purchasing/vendor-credits', locked: entitlements ? !hasFeature(entitlements, 'expenses.vendor-credits') : false },
                { label: 'Mileage', href: '/purchasing/mileage', locked: entitlements ? !hasFeature(entitlements, 'expenses.mileage-tracking') : false },
              ]}
            />

            {/* Banking & Reconciliations */}
            <ModuleSection
              icon="🏦"
              title="Banking & Cash Management"
              description="Import bank transactions and reconcile cash against the general ledger."
              links={[
                { label: 'Import Statement', href: '/banking/import', locked: entitlements ? !hasFeature(entitlements, 'accounting.bank-reconciliation') : false },
                { label: 'Reconcile Accounts', href: '/banking/reconcile', locked: entitlements ? !hasFeature(entitlements, 'accounting.bank-reconciliation') : false },
                { label: 'Fixed Assets', href: '/accounting/fixed-assets' },
                { label: 'Loans & Amortization', href: '/accounting/loans' },
              ]}
            />

            {/* Operations & Inventory */}
            <ModuleSection
              icon="📦"
              title="Inventory & Projects"
              description="Manage stock on hand, project time logs, and profitability tracking."
              links={[
                { label: 'Product Inventory', href: '/inventory', locked: entitlements ? !hasFeature(entitlements, 'inventory.product-records') : false },
                { label: 'Project Tracking', href: '/projects', locked: entitlements ? !hasFeature(entitlements, 'projects.time-tracking') : false },
                { label: 'Budgets & Scenarios', href: '/planning', locked: entitlements ? !hasFeature(entitlements, 'planning.budgets') : false },
              ]}
            />

            {/* Payroll & People */}
            <ModuleSection
              icon="👥"
              title="Payroll & Contractors"
              description="Run employee pay runs, track W-9 contractors, and post tax liabilities."
              links={[
                { label: 'Run Payroll', href: '/payroll', locked: !hasPayroll, lockedLabel: 'Add-on required' },
                { label: 'My Paystubs', href: '/payroll/my', locked: !hasPayroll, lockedLabel: 'Add-on required' },
                { label: 'Contractor 1099s', href: '/payroll?tab=contractors', locked: !hasPayroll, lockedLabel: 'Add-on required' },
              ]}
            />

            {/* Reports & AI Intelligence */}
            <ModuleSection
              icon="✨"
              title="Intelligence & Governance"
              description="Financial statements, AI anomaly insights, approval limits & audit trail."
              links={[
                { label: 'Financial Reports', href: '/reports' },
                { label: 'AI Intelligence', href: '/intelligence' },
                { label: 'Approvals Center', href: '/approvals' },
                { label: 'Audit Trail', href: '/settings/audit-log' },
                { label: 'Help & Support', href: '/support' },
              ]}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  subtitle,
  href,
  tone,
}: {
  icon: string
  label: string
  value: string
  subtitle?: string
  href: string
  tone?: 'positive' | 'negative'
}) {
  return (
    <Link
      href={href}
      className="group bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-xl p-4 shadow-sm hover:border-teal-500 dark:hover:border-teal-500 transition-all block"
    >
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{label}</span>
        <span className="text-base group-hover:scale-110 transition-transform">{icon}</span>
      </div>
      <div
        className={
          'text-lg font-bold tracking-tight ' +
          (tone === 'positive'
            ? 'text-green-700 dark:text-green-400'
            : tone === 'negative'
            ? 'text-red-700 dark:text-red-400'
            : 'text-midnight-900 dark:text-white')
        }
      >
        {value}
      </div>
      {subtitle && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 truncate">{subtitle}</p>}
    </Link>
  )
}

function ModuleSection({
  icon,
  title,
  description,
  links,
}: {
  icon: string
  title: string
  description: string
  links: Array<{ label: string; href: string; locked?: boolean; lockedLabel?: string }>
}) {
  return (
    <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <span className="text-lg">{icon}</span>
          <h3 className="font-semibold text-sm text-midnight-900 dark:text-white">{title}</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">{description}</p>
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-midnight-800">
        {links.map((link) => (
          <ModuleLink key={link.label} href={link.href} locked={Boolean(link.locked)} lockedLabel={link.lockedLabel}>
            {link.label} →
          </ModuleLink>
        ))}
      </div>
    </div>
  )
}

function ModuleLink({
  href,
  locked,
  lockedLabel,
  children,
}: {
  href: string
  locked: boolean
  lockedLabel?: string
  children: React.ReactNode
}) {
  if (locked) {
    return (
      <Link
        href="/pricing"
        title={lockedLabel ? lockedLabel : 'Upgrade your plan to unlock this'}
        className="inline-flex items-center gap-1 text-xs py-1 px-2.5 rounded-lg bg-gray-50 dark:bg-midnight-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition"
      >
        <span>{children}</span>
        <span className="text-[9px] uppercase font-bold text-gold-600 dark:text-gold-400 bg-gold-50 dark:bg-gold-950/40 px-1.5 py-0.5 rounded">
          {lockedLabel || 'PRO'}
        </span>
      </Link>
    )
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center text-xs py-1 px-2.5 rounded-lg bg-teal-50/70 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 font-medium transition"
    >
      {children}
    </Link>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}
