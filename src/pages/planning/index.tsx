import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Account = { id: string; code: string; name: string; type: string }
type BudgetRow = {
  accountId: string
  accountCode: string
  accountName: string
  periodMonth: number
  periodYear: number
  budgeted: number
  actual: number
  variance: number
  variancePct: number | null
}
type Scenario = { id: string; name: string; basedOnActual: boolean; adjustments: Record<string, number>; createdAt: string }
type ScenarioMonthResult = { accountId: string; month: number; baseline: number; projected: number }
type Kpi = { id: string; name: string; accountIds: string[]; operation: string; targetValue: number | null; value: number }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TABS = ['Budget vs Actual', 'Scenarios', 'KPIs / Executive dashboard'] as const
type Tab = (typeof TABS)[number]

function currency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function PlanningContent() {
  const { token, currentOrg } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('Budget vs Actual')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<BudgetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ accountId: '', periodMonth: '1', amount: '' })
  const [submitting, setSubmitting] = useState(false)

  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [scenarioForm, setScenarioForm] = useState({ name: '', basedOnActual: true, accountId: '', percent: '' })
  const [scenarioRows, setScenarioRows] = useState<Array<{ accountId: string; percent: string }>>([])
  const [submittingScenario, setSubmittingScenario] = useState(false)
  const [runResults, setRunResults] = useState<Record<string, ScenarioMonthResult[]>>({})
  const [runningId, setRunningId] = useState<string | null>(null)
  const [applyMessage, setApplyMessage] = useState<string | null>(null)

  const [kpis, setKpis] = useState<Kpi[]>([])
  const [kpiForm, setKpiForm] = useState({ name: '', accountIds: [] as string[], operation: 'sum', targetValue: '' })
  const [submittingKpi, setSubmittingKpi] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [aRes, bRes, sRes, kRes] = await Promise.all([
        fetch(`/api/accounts?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/reports/budget-vs-actual?organizationId=${currentOrg.id}&periodYear=${year}`, { headers: authHeaders(token) }),
        fetch(`/api/budget-scenarios?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/kpis?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      const accs = aRes.ok ? await aRes.json() : []
      setAccounts(accs.filter((a: Account) => a.type === 'income' || a.type === 'expense'))
      if (!bRes.ok) throw new Error('Could not load budgets')
      const data = await bRes.json()
      setRows(data.rows)
      setScenarios(sRes.ok ? await sRes.json() : [])
      setKpis(kRes.ok ? await kRes.json() : [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id, year])

  useEffect(() => {
    const q = router.query.tab
    if (typeof q === 'string' && (TABS as readonly string[]).includes(q)) setTab(q as Tab)
  }, [router.query.tab])

  function addScenarioRow() {
    if (!scenarioForm.accountId || !scenarioForm.percent) return
    setScenarioRows((rs) => [...rs.filter((r) => r.accountId !== scenarioForm.accountId), { accountId: scenarioForm.accountId, percent: scenarioForm.percent }])
    setScenarioForm((f) => ({ ...f, accountId: '', percent: '' }))
  }

  async function handleCreateScenario(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !scenarioForm.name || scenarioRows.length === 0) return
    setSubmittingScenario(true)
    setError(null)
    try {
      const adjustments: Record<string, number> = {}
      for (const r of scenarioRows) adjustments[r.accountId] = Number(r.percent)
      const res = await fetch('/api/budget-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, name: scenarioForm.name, basedOnActual: scenarioForm.basedOnActual, adjustments }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create scenario')
      }
      setScenarioForm({ name: '', basedOnActual: true, accountId: '', percent: '' })
      setScenarioRows([])
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmittingScenario(false)
    }
  }

  async function handleComputeScenario(scenarioId: string) {
    if (!currentOrg) return
    setRunningId(scenarioId)
    setError(null)
    setApplyMessage(null)
    try {
      const res = await fetch(`/api/budget-scenarios/${scenarioId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ action: 'compute', year }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not compute scenario')
      }
      const results: ScenarioMonthResult[] = await res.json()
      setRunResults((r) => ({ ...r, [scenarioId]: results }))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRunningId(null)
    }
  }

  async function handleApplyScenario(scenarioId: string) {
    if (!currentOrg) return
    setRunningId(scenarioId)
    setError(null)
    setApplyMessage(null)
    try {
      const res = await fetch(`/api/budget-scenarios/${scenarioId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ action: 'apply', year }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not apply scenario')
      }
      setApplyMessage(`Applied to the ${year} budget.`)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setRunningId(null)
    }
  }

  function toggleKpiAccount(id: string) {
    setKpiForm((f) => ({ ...f, accountIds: f.accountIds.includes(id) ? f.accountIds.filter((a) => a !== id) : [...f.accountIds, id] }))
  }

  async function handleCreateKpi(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !kpiForm.name || kpiForm.accountIds.length === 0) return
    setSubmittingKpi(true)
    setError(null)
    try {
      const res = await fetch('/api/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          name: kpiForm.name,
          accountIds: kpiForm.accountIds,
          operation: kpiForm.operation,
          targetValue: kpiForm.targetValue || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create KPI')
      }
      setKpiForm({ name: '', accountIds: [], operation: 'sum', targetValue: '' })
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmittingKpi(false)
    }
  }

  function accountLabel(id: string) {
    const a = accounts.find((x) => x.id === id)
    return a ? `${a.code} ${a.name}` : id
  }

  async function handleSetBudget(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg || !form.accountId || !form.amount) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          accountId: form.accountId,
          periodMonth: Number(form.periodMonth),
          periodYear: year,
          amount: form.amount,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not save budget')
      }
      setForm((f) => ({ ...f, amount: '' }))
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0)
  const totalActual = rows.reduce((s, r) => s + r.actual, 0)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Budgeting & Planning</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
        </div>
        {(tab === 'Budget vs Actual' || tab === 'Scenarios') && (
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
            {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      <div className="mb-6 flex gap-4 border-b border-gray-200 dark:border-midnight-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-teal-600 text-teal-700 dark:text-teal-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {applyMessage && (
        <div className="mb-4 text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-3 py-2">{applyMessage}</div>
      )}

      {tab === 'Budget vs Actual' && (
      <>
      <form onSubmit={handleSetBudget} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid grid-cols-4 gap-3 max-w-2xl items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Account</label>
          <select value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
            <option value="">--</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Month</label>
          <select value={form.periodMonth} onChange={(e) => setForm((f) => ({ ...f, periodMonth: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Budgeted amount</label>
          <input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          {submitting ? 'Saving…' : 'Set budget'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">No budgets set for {year} yet.</p>
      ) : (
        <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2">Month</th>
                <th className="px-4 py-2 text-right">Budgeted</th>
                <th className="px-4 py-2 text-right">Actual</th>
                <th className="px-4 py-2 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.accountId}-${r.periodMonth}`} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{r.accountCode} {r.accountName}</td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{MONTHS[r.periodMonth - 1]} {r.periodYear}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(r.budgeted)}</td>
                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(r.actual)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${r.variance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {currency(r.variance)}
                    {r.variancePct != null && ` (${r.variancePct.toFixed(0)}%)`}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-midnight-700 font-semibold">
                <td className="px-4 py-2 text-midnight-900 dark:text-white" colSpan={2}>Total</td>
                <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(totalBudgeted)}</td>
                <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(totalActual)}</td>
                <td className="px-4 py-2 text-right text-midnight-900 dark:text-white">{currency(totalActual - totalBudgeted)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      </>
      )}

      {tab === 'Scenarios' && (
        <div className="max-w-3xl">
          <form onSubmit={handleCreateScenario} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Scenario name</label>
                <input required value={scenarioForm.name} onChange={(e) => setScenarioForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                  <input type="checkbox" checked={scenarioForm.basedOnActual} onChange={(e) => setScenarioForm((f) => ({ ...f, basedOnActual: e.target.checked }))} />
                  Base on actuals (vs. budget)
                </label>
              </div>
            </div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Add percentage adjustments per account</p>
            <div className="flex gap-2 items-end mb-3">
              <select value={scenarioForm.accountId} onChange={(e) => setScenarioForm((f) => ({ ...f, accountId: e.target.value }))} className="rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm flex-1">
                <option value="">Account…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
              </select>
              <input placeholder="% change" value={scenarioForm.percent} onChange={(e) => setScenarioForm((f) => ({ ...f, percent: e.target.value }))} className="w-24 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
              <button type="button" onClick={addScenarioRow} className="rounded-md border border-gray-300 dark:border-midnight-700 px-3 py-1.5 text-sm">Add</button>
            </div>
            {scenarioRows.length > 0 && (
              <ul className="mb-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                {scenarioRows.map((r) => (
                  <li key={r.accountId}>{accountLabel(r.accountId)}: {r.percent}%</li>
                ))}
              </ul>
            )}
            <button type="submit" disabled={submittingScenario} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {submittingScenario ? 'Saving…' : 'Save scenario'}
            </button>
          </form>

          {scenarios.length === 0 ? (
            <p className="text-sm text-gray-500">No scenarios yet.</p>
          ) : (
            <div className="space-y-3">
              {scenarios.map((s) => {
                const results = runResults[s.id]
                const totalsByMonth = results
                  ? Array.from({ length: 12 }, (_, i) => {
                      const monthResults = results.filter((r) => r.month === i + 1)
                      return {
                        month: i + 1,
                        baseline: monthResults.reduce((sum, r) => sum + r.baseline, 0),
                        projected: monthResults.reduce((sum, r) => sum + r.projected, 0),
                      }
                    })
                  : []
                return (
                  <div key={s.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{s.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Based on {s.basedOnActual ? 'actuals' : 'budget'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleComputeScenario(s.id)}
                          disabled={runningId === s.id}
                          className="rounded-md border border-gray-300 dark:border-midnight-700 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:hover:bg-midnight-800 disabled:opacity-50"
                        >
                          Preview {year}
                        </button>
                        <button
                          onClick={() => handleApplyScenario(s.id)}
                          disabled={runningId === s.id}
                          className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-teal-700 disabled:opacity-50"
                        >
                          Apply to {year} budget
                        </button>
                      </div>
                    </div>
                    <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                      {Object.entries(s.adjustments || {}).map(([accountId, pct]) => (
                        <li key={accountId}>{accountLabel(accountId)}: {pct as number > 0 ? '+' : ''}{pct as number}%</li>
                      ))}
                    </ul>
                    {results && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="text-left text-gray-500 dark:text-gray-400">
                            <tr>
                              <th className="pr-3 py-1"></th>
                              {MONTHS.map((m) => <th key={m} className="pr-3 py-1 text-right">{m}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="pr-3 py-1 text-gray-500 dark:text-gray-400">Baseline</td>
                              {totalsByMonth.map((t) => <td key={t.month} className="pr-3 py-1 text-right text-gray-700 dark:text-gray-300">{currency(t.baseline)}</td>)}
                            </tr>
                            <tr>
                              <td className="pr-3 py-1 text-gray-500 dark:text-gray-400">Projected</td>
                              {totalsByMonth.map((t) => <td key={t.month} className="pr-3 py-1 text-right font-medium text-gray-900 dark:text-gray-100">{currency(t.projected)}</td>)}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'KPIs / Executive dashboard' && (
        <div className="max-w-3xl">
          <form onSubmit={handleCreateKpi} className="mb-6 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">KPI name</label>
                <input required value={kpiForm.name} onChange={(e) => setKpiForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Operation</label>
                <select value={kpiForm.operation} onChange={(e) => setKpiForm((f) => ({ ...f, operation: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
                  <option value="sum">Sum</option>
                  <option value="average">Average</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Target value (optional)</label>
                <input value={kpiForm.targetValue} onChange={(e) => setKpiForm((f) => ({ ...f, targetValue: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
              </div>
            </div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Accounts to include</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {accounts.map((a) => (
                <label key={a.id} className="flex items-center gap-1 text-xs bg-gray-50 dark:bg-midnight-800 border border-gray-200 dark:border-midnight-700 rounded-md px-2 py-1">
                  <input type="checkbox" checked={kpiForm.accountIds.includes(a.id)} onChange={() => toggleKpiAccount(a.id)} />
                  {a.code} {a.name}
                </label>
              ))}
            </div>
            <button type="submit" disabled={submittingKpi} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {submittingKpi ? 'Saving…' : 'Save KPI'}
            </button>
          </form>

          {kpis.length === 0 ? (
            <p className="text-sm text-gray-500">No KPIs defined yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {kpis.map((k) => {
                const onTarget = k.targetValue == null || k.value >= k.targetValue
                return (
                  <div key={k.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{k.name}</p>
                    <p className={`text-2xl font-semibold ${onTarget ? 'text-emerald-600' : 'text-red-600'}`}>{currency(k.value)}</p>
                    {k.targetValue != null && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Target: {currency(k.targetValue)}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlanningPage() {
  return (
    <ProtectedRoute>
      <PlanningContent />
    </ProtectedRoute>
  )
}
