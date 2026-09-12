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
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Overview</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        {planName && (
          <div className="text-right text-sm shrink-0">
            <span className="inline-block rounded-full bg-teal-50 dark:bg-midnight-800 text-teal-700 dark:text-teal-300 px-3 py-1 font-medium">
              {planName}
            </span>
            <Link href="/settings/billing" className="block mt-1 text-teal-700 dark:text-teal-400 hover:underline">
              Manage plan →
            </Link>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card label="Cash position" value={currency(summary.cash)} />
            <Card label="Revenue" value={currency(summary.revenue)} />
            <Card label="Expenses" value={currency(summary.expenses)} />
            <Card
              label="Net income"
              value={currency(summary.netIncome)}
              tone={summary.netIncome >= 0 ? 'positive' : 'negative'}
            />
            <Card label="Outstanding to collect" value={currency(summary.accountsReceivable)} />
            <Card label="Outstanding to pay" value={currency(summary.accountsPayable)} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ledger status</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {summary.accountCount} accounts &middot; {summary.journalEntryCount} posted journal entries &middot;{' '}
                {summary.openPeriods} open accounting period{summary.openPeriods === 1 ? '' : 's'}
              </p>
              <Link href="/accounting/chart-of-accounts" className="mt-3 inline-block text-sm text-teal-700 dark:text-teal-400 hover:underline">
                View chart of accounts →
              </Link>
            </div>

            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sales</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create estimates and invoices, set up recurring billing, and track what's owed.
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <Link href="/sales/invoices" className="text-teal-700 dark:text-teal-400 hover:underline">Invoices →</Link>
                <ModuleLink href="/sales/estimates" locked={entitlements ? !hasFeature(entitlements, 'sales.estimates') : false}>
                  Estimates →
                </ModuleLink>
                <ModuleLink href="/sales/recurring" locked={entitlements ? !hasFeature(entitlements, 'sales.recurring-invoices') : false}>
                  Recurring →
                </ModuleLink>
                <Link href="/sales/customers" className="text-teal-700 dark:text-teal-400 hover:underline">Customers →</Link>
              </div>
            </div>

            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Banking</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Import bank transactions and reconcile accounts against posted entries.
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <ModuleLink href="/banking/import" locked={entitlements ? !hasFeature(entitlements, 'accounting.bank-reconciliation') : false}>
                  Import CSV →
                </ModuleLink>
                <ModuleLink href="/banking/reconcile" locked={entitlements ? !hasFeature(entitlements, 'accounting.bank-reconciliation') : false}>
                  Reconcile →
                </ModuleLink>
              </div>
            </div>

            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Purchasing</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter bills and purchase orders, track vendors, vendor credits and reimbursements.
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <ModuleLink href="/purchasing/bills" locked={entitlements ? !hasFeature(entitlements, 'expenses.bill-management') : false}>
                  Bills →
                </ModuleLink>
                <ModuleLink href="/purchasing/purchase-orders" locked={entitlements ? !hasFeature(entitlements, 'expenses.purchase-orders') : false}>
                  Purchase orders →
                </ModuleLink>
                <ModuleLink href="/purchasing/vendor-credits" locked={entitlements ? !hasFeature(entitlements, 'expenses.vendor-credits') : false}>
                  Vendor credits →
                </ModuleLink>
                <ModuleLink href="/purchasing/reimbursements" locked={entitlements ? !hasFeature(entitlements, 'expenses.expense-reimbursements') : false}>
                  Reimbursements →
                </ModuleLink>
                <ModuleLink href="/purchasing/mileage" locked={entitlements ? !hasFeature(entitlements, 'expenses.mileage-tracking') : false}>
                  Mileage →
                </ModuleLink>
                <Link href="/purchasing/vendors" className="text-teal-700 dark:text-teal-400 hover:underline">Vendors →</Link>
              </div>
            </div>

            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Inventory & Projects</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Track products, stock on hand, project time and profitability.
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <ModuleLink href="/inventory" locked={entitlements ? !hasFeature(entitlements, 'inventory.product-records') : false}>
                  Inventory →
                </ModuleLink>
                <ModuleLink href="/projects" locked={entitlements ? !hasFeature(entitlements, 'projects.time-tracking') : false}>
                  Projects →
                </ModuleLink>
              </div>
            </div>

            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Planning & Payroll</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Set budgets, compare against actuals, and record payroll's accounting impact.
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <ModuleLink href="/planning" locked={entitlements ? !hasFeature(entitlements, 'planning.budgets') : false}>
                  Budgets →
                </ModuleLink>
                <ModuleLink href="/payroll" locked={!hasPayroll} lockedLabel="Add-on required">
                  Payroll →
                </ModuleLink>
              </div>
            </div>

            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Reports & Intelligence</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Trial balance, P&L, balance sheet, aging, tax summary and rule-based insights and chat.
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <Link href="/reports" className="text-teal-700 dark:text-teal-400 hover:underline">Reports →</Link>
                <Link href="/intelligence" className="text-teal-700 dark:text-teal-400 hover:underline">Intelligence →</Link>
              </div>
            </div>

            {entitlements && hasFeature(entitlements, 'nonprofit.fund-accounting') && (
              <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nonprofit</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Track restricted funds, grants, donations and pledges.
                </p>
                <div className="mt-3 flex gap-4 text-sm">
                  <Link href="/settings/funds" className="text-teal-700 dark:text-teal-400 hover:underline">Funds & grants →</Link>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Team & Controls</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Custom roles, custom fields, workflow automation, approval limits and audit history.
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <ModuleLink href="/settings/roles" locked={entitlements ? !hasFeature(entitlements, 'team.custom-roles') : false}>
                  Roles →
                </ModuleLink>
                <ModuleLink href="/settings/custom-fields" locked={entitlements ? !hasFeature(entitlements, 'team.custom-fields') : false}>
                  Custom fields →
                </ModuleLink>
                <ModuleLink href="/settings/workflows" locked={entitlements ? !hasFeature(entitlements, 'team.workflow-automation') : false}>
                  Workflows →
                </ModuleLink>
                <ModuleLink href="/settings/approval-thresholds" locked={entitlements ? !hasFeature(entitlements, 'team.approval-limits') : false}>
                  Approval limits →
                </ModuleLink>
                <ModuleLink href="/settings/audit-log" locked={entitlements ? !hasFeature(entitlements, 'team.audit-history') : false}>
                  Audit history →
                </ModuleLink>
              </div>
            </div>

            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Support</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Submit a ticket and see your plan's expected response time.
              </p>
              <div className="mt-3 flex gap-4 text-sm">
                <Link href="/support" className="text-teal-700 dark:text-teal-400 hover:underline">Support →</Link>
              </div>
            </div>
          </div>

          <p className="mt-8 text-xs text-gray-400">
            Live bank feeds, payment processing, OCR, payroll tax filing and direct deposit are not implemented — see Settings → Integrations and the Payroll page for details.
          </p>
        </>
      ) : null}
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
        className="text-gray-400 dark:text-gray-600 hover:underline"
      >
        {children} <span className="text-[10px] uppercase tracking-wide">{lockedLabel || 'Upgrade'}</span>
      </Link>
    )
  }
  return (
    <Link href={href} className="text-teal-700 dark:text-teal-400 hover:underline">
      {children}
    </Link>
  )
}

function Card({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={
          'mt-1 text-lg font-semibold ' +
          (tone === 'positive'
            ? 'text-green-700 dark:text-green-400'
            : tone === 'negative'
            ? 'text-red-700 dark:text-red-400'
            : 'text-midnight-900 dark:text-white')
        }
      >
        {value}
      </p>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}
