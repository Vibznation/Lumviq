import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Employee = { id: string; name: string; email: string | null; payType: string; rate: string; active: boolean }
type PayRunLine = { id: string; grossPay: string; employeeTax: string; netPay: string; employee: Employee }
type PayRun = {
  id: string
  payPeriodStart: string
  payPeriodEnd: string
  status: string
  totalGross: string
  totalEmployeeTax: string
  totalEmployerTax: string
  totalNetPay: string
  lines: PayRunLine[]
}

function currency(n: string | number) {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function PayrollContent() {
  const { token, currentOrg } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payRuns, setPayRuns] = useState<PayRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [empForm, setEmpForm] = useState({ name: '', email: '', payType: 'salary', rate: '' })
  const [savingEmp, setSavingEmp] = useState(false)

  const [showRunForm, setShowRunForm] = useState(false)
  const [runForm, setRunForm] = useState({ payPeriodStart: '', payPeriodEnd: '' })
  const [runLines, setRunLines] = useState<{ employeeId: string; grossPay: string }[]>([])
  const [savingRun, setSavingRun] = useState(false)
  const [posting, setPosting] = useState<string | null>(null)

  const [providerRunId, setProviderRunId] = useState<string | null>(null)
  const [providerForm, setProviderForm] = useState<{ employerTax: string; lines: { lineId: string; employeeTax: string }[] }>({ employerTax: '', lines: [] })
  const [savingProvider, setSavingProvider] = useState(false)

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [eRes, rRes] = await Promise.all([
        fetch(`/api/employees?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
        fetch(`/api/pay-runs?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      ])
      if (!eRes.ok) throw new Error('Could not load employees')
      setEmployees(await eRes.json())
      setPayRuns(rRes.ok ? await rRes.json() : [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id])

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    setSavingEmp(true)
    setError(null)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...empForm }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create employee')
      }
      setEmpForm({ name: '', email: '', payType: 'salary', rate: '' })
      setShowEmployeeForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingEmp(false)
    }
  }

  function openRunForm() {
    setRunLines(employees.filter((e) => e.active).map((e) => ({ employeeId: e.id, grossPay: '' })))
    setShowRunForm(true)
  }

  async function handleCreateRun(e: React.FormEvent) {
    e.preventDefault()
    if (!currentOrg) return
    const lines = runLines.filter((l) => l.grossPay)
    if (lines.length === 0) return setError('Enter gross pay for at least one employee')
    setSavingRun(true)
    setError(null)
    try {
      const res = await fetch('/api/pay-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, ...runForm, lines }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not create pay run')
      }
      setRunForm({ payPeriodStart: '', payPeriodEnd: '' })
      setShowRunForm(false)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingRun(false)
    }
  }

  async function handlePost(id: string) {
    setPosting(id)
    setError(null)
    try {
      const res = await fetch(`/api/pay-runs/${id}/post`, { method: 'POST', headers: authHeaders(token) })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not post pay run')
      }
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setPosting(null)
    }
  }

  function openProviderForm(pr: PayRun) {
    setProviderForm({
      employerTax: pr.totalEmployerTax !== '0' && pr.totalEmployerTax !== '0.000000' ? pr.totalEmployerTax : '',
      lines: pr.lines.map((l) => ({ lineId: l.id, employeeTax: l.employeeTax !== '0' && l.employeeTax !== '0.000000' ? l.employeeTax : '' })),
    })
    setProviderRunId(pr.id)
  }

  async function handleSaveProviderTotals(e: React.FormEvent) {
    e.preventDefault()
    if (!providerRunId) return
    setSavingProvider(true)
    setError(null)
    try {
      const res = await fetch(`/api/pay-runs/${providerRunId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          employerTax: providerForm.employerTax || '0',
          lines: providerForm.lines.map((l) => ({ id: l.lineId, employeeTax: l.employeeTax || '0' })),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not save payroll provider totals')
      }
      setProviderRunId(null)
      await load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingProvider(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Payroll</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
      </div>

      <div className="mb-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        <strong>Scope limitation:</strong> Lumviq records the accounting impact of a pay run (payroll expense and
        liabilities) only. It does not calculate tax withholding, file payroll tax returns, or perform direct deposit.
        Run payroll with a licensed payroll provider, then use "Enter provider totals" below to record each
        employee's tax withholding and the employer's payroll tax expense before posting.
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Employees</h2>
          <button onClick={() => setShowEmployeeForm((s) => !s)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
            {showEmployeeForm ? 'Cancel' : '+ Add employee'}
          </button>
        </div>
        {showEmployeeForm && (
          <form onSubmit={handleCreateEmployee} className="mb-4 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid grid-cols-2 gap-3 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
              <input required value={empForm.name} onChange={(e) => setEmpForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Email</label>
              <input value={empForm.email} onChange={(e) => setEmpForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Pay type</label>
              <select value={empForm.payType} onChange={(e) => setEmpForm((f) => ({ ...f, payType: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm">
                <option value="salary">Salary</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Rate</label>
              <input required value={empForm.rate} onChange={(e) => setEmpForm((f) => ({ ...f, rate: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
            </div>
            <div className="col-span-2">
              <button type="submit" disabled={savingEmp} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                {savingEmp ? 'Saving…' : 'Save employee'}
              </button>
            </div>
          </form>
        )}
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : employees.length === 0 ? (
          <p className="text-sm text-gray-500">No employees yet.</p>
        ) : (
          <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Pay type</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-t border-gray-100 dark:border-midnight-800">
                    <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{emp.name}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{emp.payType}</td>
                    <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(emp.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pay runs</h2>
          <button onClick={openRunForm} disabled={employees.length === 0} className="text-xs text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50">
            + New pay run
          </button>
        </div>

        {showRunForm && (
          <form onSubmit={handleCreateRun} className="mb-4 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 max-w-2xl space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Pay period start</label>
                <input type="date" required value={runForm.payPeriodStart} onChange={(e) => setRunForm((f) => ({ ...f, payPeriodStart: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Pay period end</label>
                <input type="date" required value={runForm.payPeriodEnd} onChange={(e) => setRunForm((f) => ({ ...f, payPeriodEnd: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm" />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                <tr><th className="py-1">Employee</th><th className="py-1 text-right">Gross pay</th></tr>
              </thead>
              <tbody>
                {employees.filter((e) => e.active).map((emp, i) => (
                  <tr key={emp.id}>
                    <td className="py-1 text-gray-900 dark:text-gray-100">{emp.name}</td>
                    <td className="py-1 text-right">
                      <input
                        value={runLines[i]?.grossPay || ''}
                        onChange={(e) => setRunLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, grossPay: e.target.value } : l)))}
                        className="w-32 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1 text-sm text-right"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="submit" disabled={savingRun} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {savingRun ? 'Saving…' : 'Save pay run'}
            </button>
          </form>
        )}

        {payRuns.length === 0 ? (
          <p className="text-sm text-gray-500">No pay runs yet.</p>
        ) : (
          <div className="space-y-3">
            {payRuns.map((pr) => (
              <div key={pr.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-midnight-900 dark:text-white">
                      {new Date(pr.payPeriodStart).toLocaleDateString()} – {new Date(pr.payPeriodEnd).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {pr.lines.length} employees &middot; {currency(pr.totalGross)} gross
                      {Number(pr.totalEmployeeTax) > 0 || Number(pr.totalEmployerTax) > 0 ? (
                        <>
                          {' '}&middot; {currency(pr.totalEmployeeTax)} employee tax &middot; {currency(pr.totalEmployerTax)} employer tax &middot; {currency(pr.totalNetPay)} net pay
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-midnight-800 dark:text-gray-300">
                      {pr.status}
                    </span>
                    {pr.status === 'draft' && (
                      <>
                        <button onClick={() => openProviderForm(pr)} className="rounded-md border border-gray-300 dark:border-midnight-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-midnight-800">
                          Enter provider totals
                        </button>
                        <button onClick={() => handlePost(pr.id)} disabled={posting === pr.id} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                          Post to ledger
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {providerRunId === pr.id && (
                  <form onSubmit={handleSaveProviderTotals} className="mt-4 border-t border-gray-100 dark:border-midnight-800 pt-4 space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Enter the results from your payroll provider's report for this pay period.
                    </p>
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        <tr>
                          <th className="py-1">Employee</th>
                          <th className="py-1 text-right">Gross pay</th>
                          <th className="py-1 text-right">Tax withholding</th>
                          <th className="py-1 text-right">Net pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pr.lines.map((line, i) => {
                          const taxInput = providerForm.lines[i]?.employeeTax || ''
                          const netPay = Number(line.grossPay) - (Number(taxInput) || 0)
                          return (
                            <tr key={line.id}>
                              <td className="py-1 text-gray-900 dark:text-gray-100">{line.employee.name}</td>
                              <td className="py-1 text-right text-gray-500 dark:text-gray-400">{currency(line.grossPay)}</td>
                              <td className="py-1 text-right">
                                <input
                                  value={taxInput}
                                  onChange={(e) => setProviderForm((f) => ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, employeeTax: e.target.value } : l)) }))}
                                  className="w-28 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1 text-sm text-right"
                                />
                              </td>
                              <td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(netPay)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div className="max-w-xs">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Employer payroll tax expense (total)</label>
                      <input
                        value={providerForm.employerTax}
                        onChange={(e) => setProviderForm((f) => ({ ...f, employerTax: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={savingProvider} className="rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                        {savingProvider ? 'Saving…' : 'Save totals'}
                      </button>
                      <button type="button" onClick={() => setProviderRunId(null)} className="rounded-md border border-gray-300 dark:border-midnight-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function PayrollPage() {
  return (
    <ProtectedRoute>
      <PayrollContent />
    </ProtectedRoute>
  )
}
