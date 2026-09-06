import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type TrialBalanceRow = { accountId: string; code: string; name: string; type: string; debitBalance: number; creditBalance: number }
type Financials = {
  trialBalance: TrialBalanceRow[]
  totalDebits: number
  totalCredits: number
  profitAndLoss: { revenue: number; expenses: number; netIncome: number }
  balanceSheet: { totalAssets: number; totalLiabilities: number; totalEquity: number; currentPeriodNetIncome: number; totalLiabilitiesAndEquity: number }
}
type AgingRow = { balance: number; daysOverdue: number; bucket: string; [k: string]: any }
type AgingReport = { rows: AgingRow[]; buckets: Record<string, number>; total: number }
type TaxSummary = { summary: Array<{ name: string; collected: number; paid: number; netOwed: number }>; totalNetOwed: number }
type Product = { name: string; type: string; quantityOnHand: string; costPrice: string | null }

const TABS = ['Financials', 'AR Aging', 'AP Aging', 'Tax Summary', 'Inventory Valuation'] as const
type Tab = (typeof TABS)[number]

function currency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function ReportsContent() {
  const { token, currentOrg } = useAuth()
  const [tab, setTab] = useState<Tab>('Financials')
  const [financials, setFinancials] = useState<Financials | null>(null)
  const [arAging, setArAging] = useState<AgingReport | null>(null)
  const [apAging, setApAging] = useState<AgingReport | null>(null)
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/api/reports/financials?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      fetch(`/api/reports/ar-aging?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      fetch(`/api/reports/ap-aging?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      fetch(`/api/reports/tax-summary?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      fetch(`/api/products?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
    ])
      .then(async ([f, ar, ap, tax, p]) => {
        if (!f.ok) throw new Error('Could not load financial reports')
        setFinancials(await f.json())
        setArAging(ar.ok ? await ar.json() : null)
        setApAging(ap.ok ? await ap.json() : null)
        setTaxSummary(tax.ok ? await tax.json() : null)
        setProducts(p.ok ? await p.json() : [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [currentOrg?.id, token])

  const inventoryValue = products
    .filter((p) => p.type === 'inventory')
    .reduce((s, p) => s + Number(p.quantityOnHand) * Number(p.costPrice || 0), 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Reports</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name} — figures computed directly from your ledger</p>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-gray-200 dark:border-midnight-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-teal-600 text-teal-700 dark:text-teal-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          {tab === 'Financials' && financials && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4 max-w-2xl">
                <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
                  <p className="text-lg font-semibold text-midnight-900 dark:text-white">{currency(financials.profitAndLoss.revenue)}</p>
                </div>
                <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Expenses</p>
                  <p className="text-lg font-semibold text-midnight-900 dark:text-white">{currency(financials.profitAndLoss.expenses)}</p>
                </div>
                <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Net income</p>
                  <p className="text-lg font-semibold text-midnight-900 dark:text-white">{currency(financials.profitAndLoss.netIncome)}</p>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Balance sheet</h2>
                <table className="w-full text-sm max-w-md">
                  <tbody>
                    <tr className="border-b border-gray-100 dark:border-midnight-800"><td className="py-1 text-gray-600 dark:text-gray-400">Total assets</td><td className="py-1 text-right">{currency(financials.balanceSheet.totalAssets)}</td></tr>
                    <tr className="border-b border-gray-100 dark:border-midnight-800"><td className="py-1 text-gray-600 dark:text-gray-400">Total liabilities</td><td className="py-1 text-right">{currency(financials.balanceSheet.totalLiabilities)}</td></tr>
                    <tr className="border-b border-gray-100 dark:border-midnight-800"><td className="py-1 text-gray-600 dark:text-gray-400">Total equity</td><td className="py-1 text-right">{currency(financials.balanceSheet.totalEquity)}</td></tr>
                    <tr className="border-b border-gray-100 dark:border-midnight-800"><td className="py-1 text-gray-600 dark:text-gray-400">Current period net income</td><td className="py-1 text-right">{currency(financials.balanceSheet.currentPeriodNetIncome)}</td></tr>
                    <tr className="font-semibold"><td className="py-1 text-midnight-900 dark:text-white">Liabilities + equity</td><td className="py-1 text-right">{currency(financials.balanceSheet.totalLiabilitiesAndEquity)}</td></tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Trial balance</h2>
                <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden max-w-2xl">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      <tr><th className="px-4 py-2">Account</th><th className="px-4 py-2 text-right">Debit</th><th className="px-4 py-2 text-right">Credit</th></tr>
                    </thead>
                    <tbody>
                      {financials.trialBalance.filter((r) => r.debitBalance !== 0 || r.creditBalance !== 0).map((r) => (
                        <tr key={r.accountId} className="border-t border-gray-100 dark:border-midnight-800">
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.code} {r.name}</td>
                          <td className="px-4 py-2 text-right">{r.debitBalance !== 0 ? currency(r.debitBalance) : ''}</td>
                          <td className="px-4 py-2 text-right">{r.creditBalance !== 0 ? currency(r.creditBalance) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 dark:border-midnight-700 font-semibold">
                        <td className="px-4 py-2 text-midnight-900 dark:text-white">Total</td>
                        <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(financials.totalDebits)}</td>
                        <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(financials.totalCredits)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'AR Aging' && arAging && (
            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden max-w-3xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  <tr><th className="px-4 py-2">Invoice</th><th className="px-4 py-2">Customer</th><th className="px-4 py-2 text-right">Balance</th><th className="px-4 py-2">Bucket</th></tr>
                </thead>
                <tbody>
                  {arAging.rows.map((r: any) => (
                    <tr key={r.invoiceId} className="border-t border-gray-100 dark:border-midnight-800">
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.invoiceNumber}</td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.customerName}</td>
                      <td className="px-4 py-2 text-right">{currency(r.balance)}</td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.bucket}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-midnight-700 font-semibold">
                    <td className="px-4 py-2 text-midnight-900 dark:text-white" colSpan={2}>Total</td>
                    <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(arAging.total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {tab === 'AP Aging' && apAging && (
            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden max-w-3xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  <tr><th className="px-4 py-2">Bill</th><th className="px-4 py-2">Vendor</th><th className="px-4 py-2 text-right">Balance</th><th className="px-4 py-2">Bucket</th></tr>
                </thead>
                <tbody>
                  {apAging.rows.map((r: any) => (
                    <tr key={r.billId} className="border-t border-gray-100 dark:border-midnight-800">
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.billNumber}</td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.vendorName}</td>
                      <td className="px-4 py-2 text-right">{currency(r.balance)}</td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{r.bucket}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-midnight-700 font-semibold">
                    <td className="px-4 py-2 text-midnight-900 dark:text-white" colSpan={2}>Total</td>
                    <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(apAging.total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {tab === 'Tax Summary' && taxSummary && (
            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden max-w-2xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  <tr><th className="px-4 py-2">Tax rate</th><th className="px-4 py-2 text-right">Collected</th><th className="px-4 py-2 text-right">Paid</th><th className="px-4 py-2 text-right">Net owed</th></tr>
                </thead>
                <tbody>
                  {taxSummary.summary.map((r) => (
                    <tr key={r.name} className="border-t border-gray-100 dark:border-midnight-800">
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.name}</td>
                      <td className="px-4 py-2 text-right">{currency(r.collected)}</td>
                      <td className="px-4 py-2 text-right">{currency(r.paid)}</td>
                      <td className="px-4 py-2 text-right">{currency(r.netOwed)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 dark:border-midnight-700 font-semibold">
                    <td className="px-4 py-2 text-midnight-900 dark:text-white" colSpan={3}>Total net owed</td>
                    <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(taxSummary.totalNetOwed)}</td>
                  </tr>
                </tfoot>
              </table>
              <p className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-midnight-800">
                Informational only — Lumviq does not file tax returns on your behalf.
              </p>
            </div>
          )}

          {tab === 'Inventory Valuation' && (
            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 max-w-md">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total inventory value (average cost)</p>
              <p className="text-lg font-semibold text-midnight-900 dark:text-white">{currency(inventoryValue)}</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Sum of on-hand quantity × average cost across all inventory-tracked products.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsContent />
    </ProtectedRoute>
  )
}
