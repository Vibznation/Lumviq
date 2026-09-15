import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type TrialBalanceRow = { accountId: string; code: string; name: string; type: string; debitBalance: number; creditBalance: number }
type Financials = {
  trialBalance: TrialBalanceRow[]
  totalDebits: number
  totalCredits: number
  profitAndLoss: { revenue: number; expenses: number; netIncome: number }
  comparison?: { revenue: number; expenses: number; netIncome: number }
  basis: string
  balanceSheet: { totalAssets: number; totalLiabilities: number; totalEquity: number; currentPeriodNetIncome: number; totalLiabilitiesAndEquity: number }
}
type AgingRow = { balance: number; daysOverdue: number; bucket: string; [k: string]: any }
type AgingReport = { rows: AgingRow[]; buckets: Record<string, number>; total: number }
type TaxSummary = { summary: Array<{ name: string; collected: number; paid: number; netOwed: number }>; totalNetOwed: number }
type Product = { name: string; type: string; quantityOnHand: string; costPrice: string | null }
type JobCostingRow = { projectId: string; name: string; status: string; budgetAmount: number | null; totalHours: number; billedHours: number; laborCost: number; revenueInvoiced: number; margin: number; staffAssigned: number; overBudget: boolean }
type ProductProfitabilityRow = { productId: string; name: string; unitsSold: number; revenue: number; cogs: number; grossProfit: number; marginPercent: number | null }
type Customer = { id: string; name: string }
type CustomerStatementInvoice = { invoiceNumber: string; issueDate: string; dueDate: string; total: number; amountPaid: number; balance: number; overdue: boolean }
type AccountOption = { id: string; code: string; name: string; type: string }
type GlLine = { id: string; accountId: string; description: string | null; amount: string; isDebit: boolean; journalEntryId: string; journalEntryDescription: string | null; postedAt: string | null }
type CashFlow = { operating: number; investing: number; financing: number; netChangeInCash: number; beginningCash: number; endingCash: number; note?: string }

const TABS = ['Financials', 'General Ledger', 'Cash Flow', 'AR Aging', 'AP Aging', 'Tax Summary', 'Inventory Valuation', 'Job Costing', 'Product Profitability', 'Customer Statements'] as const
type Tab = (typeof TABS)[number]

function currency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function downloadCsv(filename: string, columns: string[], rows: Record<string, any>[]) {
  const escape = (value: any) => {
    const str = value == null ? '' : String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }
  const lines = [columns.join(','), ...rows.map((row) => columns.map((c) => escape(row[c])).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

function ExportCsvButton({ filename, columns, rows }: { filename: string; columns: string[]; rows: Record<string, any>[] }) {
  return (
    <button
      onClick={() => downloadCsv(filename, columns, rows)}
      className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
    >
      Export CSV
    </button>
  )
}

function ReportsContent() {
  const { token, currentOrg } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('Financials')

  useEffect(() => {
    const queryTab = router.query.tab
    if (typeof queryTab === 'string' && (TABS as readonly string[]).includes(queryTab)) {
      setTab(queryTab as Tab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.tab])
  const [financials, setFinancials] = useState<Financials | null>(null)
  const [arAging, setArAging] = useState<AgingReport | null>(null)
  const [apAging, setApAging] = useState<AgingReport | null>(null)
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [jobCosting, setJobCosting] = useState<JobCostingRow[]>([])
  const [productProfitability, setProductProfitability] = useState<ProductProfitabilityRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [statementCustomerId, setStatementCustomerId] = useState('')
  const [statement, setStatement] = useState<CustomerStatementInvoice[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Phase 4: period filters shared by Financials / Cash Flow / General Ledger / Tax Summary / Job Costing / Product Profitability.
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [compareStartDate, setCompareStartDate] = useState('')
  const [compareEndDate, setCompareEndDate] = useState('')
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual')
  const [asOfDate, setAsOfDate] = useState('')

  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [glAccountId, setGlAccountId] = useState('')
  const [glLines, setGlLines] = useState<GlLine[]>([])
  const [glLoading, setGlLoading] = useState(false)
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null)

  function periodParams() {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    return params
  }

  useEffect(() => {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    const p = periodParams()
    const financialsParams = new URLSearchParams(p)
    financialsParams.set('basis', basis)
    if (compareEnabled && compareStartDate) financialsParams.set('compareStartDate', compareStartDate)
    if (compareEnabled && compareEndDate) financialsParams.set('compareEndDate', compareEndDate)
    const agingParams = new URLSearchParams()
    if (asOfDate) agingParams.set('asOfDate', asOfDate)
    Promise.all([
      fetch(`/api/reports/financials?organizationId=${currentOrg.id}&${financialsParams}`, { headers: authHeaders(token) }),
      fetch(`/api/reports/ar-aging?organizationId=${currentOrg.id}&${agingParams}`, { headers: authHeaders(token) }),
      fetch(`/api/reports/ap-aging?organizationId=${currentOrg.id}&${agingParams}`, { headers: authHeaders(token) }),
      fetch(`/api/reports/tax-summary?organizationId=${currentOrg.id}&${p}`, { headers: authHeaders(token) }),
      fetch(`/api/products?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      fetch(`/api/reports/job-costing?organizationId=${currentOrg.id}&${p}`, { headers: authHeaders(token) }),
      fetch(`/api/reports/product-profitability?organizationId=${currentOrg.id}&${p}`, { headers: authHeaders(token) }),
      fetch(`/api/customers?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      fetch(`/api/reports/cash-flow?organizationId=${currentOrg.id}&${p}`, { headers: authHeaders(token) }),
    ])
      .then(async ([f, ar, ap, tax, p2, jc, pp, c, acc, cf]) => {
        if (!f.ok) throw new Error('Could not load financial reports')
        setFinancials(await f.json())
        setArAging(ar.ok ? await ar.json() : null)
        setApAging(ap.ok ? await ap.json() : null)
        setTaxSummary(tax.ok ? await tax.json() : null)
        setProducts(p2.ok ? await p2.json() : [])
        setJobCosting(jc.ok ? (await jc.json()).projects : [])
        setProductProfitability(pp.ok ? (await pp.json()).products : [])
        const custList = c.ok ? await c.json() : []
        setCustomers(custList)
        if (custList.length > 0 && !statementCustomerId) setStatementCustomerId(custList[0].id)
        setAccounts(acc.ok ? await acc.json() : [])
        setCashFlow(cf.ok ? await cf.json() : null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, token, startDate, endDate, basis, compareEnabled, compareStartDate, compareEndDate, asOfDate])

  useEffect(() => {
    if (!currentOrg || !statementCustomerId) return
    const p = periodParams()
    fetch(`/api/reports/customer-statement?organizationId=${currentOrg.id}&customerId=${statementCustomerId}&${p}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : { invoices: [] }))
      .then((d) => setStatement(d.invoices))
      .catch(() => setStatement([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, statementCustomerId, token, startDate, endDate])

  useEffect(() => {
    if (!currentOrg || !glAccountId) {
      setGlLines([])
      return
    }
    setGlLoading(true)
    const p = periodParams()
    fetch(`/api/journal/lines?organizationId=${currentOrg.id}&accountId=${glAccountId}&${p}`, { headers: authHeaders(token) })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setGlLines(d))
      .catch(() => setGlLines([]))
      .finally(() => setGlLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, glAccountId, token, startDate, endDate])

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

      {(tab === 'Financials' || tab === 'General Ledger' || tab === 'Cash Flow' || tab === 'Tax Summary' || tab === 'Job Costing' || tab === 'Product Profitability' || tab === 'Customer Statements') && (
        <div className="mb-4 flex flex-wrap items-end gap-4 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">End date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          {(startDate || endDate) && (
            <button onClick={() => { setStartDate(''); setEndDate('') }} className="text-xs text-gray-500 hover:underline">Clear dates</button>
          )}
          {tab === 'Financials' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Basis</label>
                <select value={basis} onChange={(e) => setBasis(e.target.value as 'accrual' | 'cash')} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
                  <option value="accrual">Accrual</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input type="checkbox" checked={compareEnabled} onChange={(e) => setCompareEnabled(e.target.checked)} />
                Compare to another period
              </label>
              {compareEnabled && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Compare start</label>
                    <input type="date" value={compareStartDate} onChange={(e) => setCompareStartDate(e.target.value)} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Compare end</label>
                    <input type="date" value={compareEndDate} onChange={(e) => setCompareEndDate(e.target.value)} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {(tab === 'AR Aging' || tab === 'AP Aging') && (
        <div className="mb-4 flex items-end gap-4 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">As of date</label>
            <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
          </div>
          {asOfDate && <button onClick={() => setAsOfDate('')} className="text-xs text-gray-500 hover:underline">Reset to today</button>}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          {tab === 'Financials' && financials && (
            <div className="space-y-6">
              <div className="flex items-center justify-between max-w-2xl">
                <div className="grid grid-cols-3 gap-4 flex-1">
                  <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
                    <p className="text-lg font-semibold text-midnight-900 dark:text-white">{currency(financials.profitAndLoss.revenue)}</p>
                    {financials.comparison && <p className="text-xs text-gray-400 mt-1">vs {currency(financials.comparison.revenue)}</p>}
                  </div>
                  <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Expenses</p>
                    <p className="text-lg font-semibold text-midnight-900 dark:text-white">{currency(financials.profitAndLoss.expenses)}</p>
                    {financials.comparison && <p className="text-xs text-gray-400 mt-1">vs {currency(financials.comparison.expenses)}</p>}
                  </div>
                  <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Net income</p>
                    <p className="text-lg font-semibold text-midnight-900 dark:text-white">{currency(financials.profitAndLoss.netIncome)}</p>
                    {financials.comparison && <p className="text-xs text-gray-400 mt-1">vs {currency(financials.comparison.netIncome)}</p>}
                  </div>
                </div>
                <div className="pl-4 self-start pt-1">
                  <ExportCsvButton
                    filename="trial-balance.csv"
                    columns={['code', 'name', 'type', 'debitBalance', 'creditBalance']}
                    rows={financials.trialBalance}
                  />
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
                          <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                            <Link href={`/accounting/general-ledger/${r.accountId}`} className="text-teal-700 dark:text-teal-400 hover:underline">
                              {r.code} {r.name}
                            </Link>
                          </td>
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

          {tab === 'General Ledger' && (
            <div className="space-y-4">
              <div className="max-w-xs">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Account</label>
                <select
                  value={glAccountId}
                  onChange={(e) => setGlAccountId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                >
                  <option value="">Select an account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                  ))}
                </select>
              </div>

              {!glAccountId && <p className="text-sm text-gray-500 dark:text-gray-400">Choose an account to view its ledger activity.</p>}

              {glAccountId && glLoading && <p className="text-sm text-gray-500">Loading…</p>}

              {glAccountId && !glLoading && (
                <div>
                  <div className="flex justify-end mb-2">
                    <ExportCsvButton
                      filename="general-ledger.csv"
                      columns={['postedAt', 'journalEntryDescription', 'description', 'isDebit', 'amount']}
                      rows={glLines}
                    />
                  </div>
                  <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden max-w-3xl">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        <tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Description</th><th className="px-4 py-2 text-right">Debit</th><th className="px-4 py-2 text-right">Credit</th></tr>
                      </thead>
                      <tbody>
                        {glLines.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-4 text-center text-gray-400">No activity for this account in the selected period.</td></tr>
                        )}
                        {glLines.map((l) => (
                          <tr key={l.id} className="border-t border-gray-100 dark:border-midnight-800">
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{l.postedAt ? new Date(l.postedAt).toLocaleDateString() : '—'}</td>
                            <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{l.description || l.journalEntryDescription || '—'}</td>
                            <td className="px-4 py-2 text-right">{l.isDebit ? currency(Number(l.amount)) : ''}</td>
                            <td className="px-4 py-2 text-right">{!l.isDebit ? currency(Number(l.amount)) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'Cash Flow' && cashFlow && (
            <div className="space-y-4">
              {cashFlow.note && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 max-w-2xl">{cashFlow.note}</div>
              )}
              <div className="grid grid-cols-3 gap-4 max-w-3xl">
                <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Operating</p>
                  <p className="text-lg font-semibold text-midnight-900 dark:text-white">{currency(cashFlow.operating)}</p>
                </div>
                <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Investing</p>
                  <p className="text-lg font-semibold text-midnight-900 dark:text-white">{currency(cashFlow.investing)}</p>
                </div>
                <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Financing</p>
                  <p className="text-lg font-semibold text-midnight-900 dark:text-white">{currency(cashFlow.financing)}</p>
                </div>
              </div>
              <table className="text-sm max-w-md">
                <tbody>
                  <tr className="border-b border-gray-100 dark:border-midnight-800"><td className="py-1 text-gray-600 dark:text-gray-400">Beginning cash</td><td className="py-1 text-right">{currency(cashFlow.beginningCash)}</td></tr>
                  <tr className="border-b border-gray-100 dark:border-midnight-800"><td className="py-1 text-gray-600 dark:text-gray-400">Net change in cash</td><td className="py-1 text-right">{currency(cashFlow.netChangeInCash)}</td></tr>
                  <tr className="font-semibold"><td className="py-1 text-midnight-900 dark:text-white">Ending cash</td><td className="py-1 text-right">{currency(cashFlow.endingCash)}</td></tr>
                </tbody>
              </table>
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

          {tab === 'Job Costing' && (
            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden max-w-4xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2">Project</th>
                    <th className="px-4 py-2 text-right">Budget</th>
                    <th className="px-4 py-2 text-right">Hours</th>
                    <th className="px-4 py-2 text-right">Labor cost</th>
                    <th className="px-4 py-2 text-right">Revenue invoiced</th>
                    <th className="px-4 py-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {jobCosting.map((r) => (
                    <tr key={r.projectId} className="border-t border-gray-100 dark:border-midnight-800">
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.name}{r.overBudget && <span className="ml-2 text-xs text-red-600">Over budget</span>}</td>
                      <td className="px-4 py-2 text-right">{r.budgetAmount != null ? currency(r.budgetAmount) : '—'}</td>
                      <td className="px-4 py-2 text-right">{r.totalHours.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right">{currency(r.laborCost)}</td>
                      <td className="px-4 py-2 text-right">{currency(r.revenueInvoiced)}</td>
                      <td className="px-4 py-2 text-right">{currency(r.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Product Profitability' && (
            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden max-w-4xl">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2 text-right">Units sold</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                    <th className="px-4 py-2 text-right">COGS</th>
                    <th className="px-4 py-2 text-right">Gross profit</th>
                    <th className="px-4 py-2 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {productProfitability.map((r) => (
                    <tr key={r.productId} className="border-t border-gray-100 dark:border-midnight-800">
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.name}</td>
                      <td className="px-4 py-2 text-right">{r.unitsSold}</td>
                      <td className="px-4 py-2 text-right">{currency(r.revenue)}</td>
                      <td className="px-4 py-2 text-right">{currency(r.cogs)}</td>
                      <td className="px-4 py-2 text-right">{currency(r.grossProfit)}</td>
                      <td className="px-4 py-2 text-right">{r.marginPercent != null ? `${r.marginPercent.toFixed(1)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'Customer Statements' && (
            <div className="max-w-3xl">
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Customer</label>
                <select value={statementCustomerId} onChange={(e) => setStatementCustomerId(e.target.value)} className="mt-1 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2">Invoice</th>
                      <th className="px-4 py-2">Issued</th>
                      <th className="px-4 py-2">Due</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-right">Paid</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(statement || []).map((r) => (
                      <tr key={r.invoiceNumber} className="border-t border-gray-100 dark:border-midnight-800">
                        <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.invoiceNumber}{r.overdue && <span className="ml-2 text-xs text-red-600">Overdue</span>}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(r.issueDate).toLocaleDateString()}</td>
                        <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(r.dueDate).toLocaleDateString()}</td>
                        <td className="px-4 py-2 text-right">{currency(r.total)}</td>
                        <td className="px-4 py-2 text-right">{currency(r.amountPaid)}</td>
                        <td className="px-4 py-2 text-right">{currency(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(statement || []).length === 0 && <p className="px-4 py-3 text-sm text-gray-500">No open invoices for this customer.</p>}
              </div>
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
