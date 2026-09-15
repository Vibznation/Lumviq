import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type Employee = {
  id: string
  name: string
  email: string | null
  payType: string
  rate: string
  active: boolean
  providerEmployeeId?: string | null
  onboardingStatus?: string
}
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
  providerPayrollId?: string | null
  reversalOfPayRunId?: string | null
  lines: PayRunLine[]
}
type Contractor = {
  id: string
  name: string
  email: string | null
  w9Status: string
  providerContractorId: string | null
  active: boolean
}
type CompanyProfile = {
  id: string
  legalBusinessName: string
  entityType: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  postalCode: string
  signatoryName: string
  signatoryTitle: string
  contactEmail: string
  contactPhone: string | null
  onboardingStatus: string
  providerCompanyId: string | null
} | null
type Workplace = {
  id: string
  name: string
  isPayrollWorkplace: boolean
  state: string | null
  sutaAccountNumber: string | null
  sutaRate: string | null
  providerWorkplaceId: string | null
}
type BankAccount = {
  id: string
  bankName: string | null
  accountType: string
  accountLast4: string
  verificationStatus: string
  active: boolean
  sandboxMicroDepositAmounts?: [string, string]
}
type TaxFiling = {
  id: string
  jurisdiction: string
  formType: string
  dueDate: string
  amount: string | null
  status: string
}
type TaxDocument = {
  id: string
  ownerType: string
  documentType: string
  taxYear: number
  status: string
}
type Approval = {
  id: string
  resourceType: string
  resourceId: string
  amount: string
  status: string
  createdAt: string
}
type Account = { id: string; code: string; name: string; type: string }

function currency(n: string | number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function useApi(token: string | null) {
  async function call(method: string, path: string, body?: any) {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`)
    return json
  }
  return {
    get: (path: string) => call('GET', path),
    post: (path: string, body?: any) => call('POST', path, body),
  }
}

const TABS = ['Setup', 'Employees', 'Contractors', 'Pay runs', 'Tax center', 'Reports'] as const
type Tab = (typeof TABS)[number]

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

const inputCls = 'w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1.5 text-sm'
const btnPrimary = 'rounded-md bg-teal-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-50'
const btnSecondary = 'rounded-md border border-gray-300 dark:border-midnight-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-midnight-800 disabled:opacity-50'

function SetupTab({ orgId, api, onError }: { orgId: string; api: ReturnType<typeof useApi>; onError: (m: string | null) => void }) {
  const [company, setCompany] = useState<CompanyProfile>(null)
  const [form, setForm] = useState({
    legalBusinessName: '', entityType: 'llc', ein: '', addressLine1: '', addressLine2: '',
    city: '', state: '', postalCode: '', signatoryName: '', signatoryTitle: '', contactEmail: '', contactPhone: '',
  })
  const [saving, setSaving] = useState(false)
  const [workplaces, setWorkplaces] = useState<Workplace[]>([])
  const [wpForm, setWpForm] = useState({ name: '', state: '', sutaAccountNumber: '', sutaRate: '' })
  const [savingWp, setSavingWp] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [bankForm, setBankForm] = useState({ bankName: '', routingNumber: '', accountNumber: '', accountType: 'checking' })
  const [savingBank, setSavingBank] = useState(false)
  const [microDeposits, setMicroDeposits] = useState<Record<string, string>>({})
  const [verifyAmounts, setVerifyAmounts] = useState<Record<string, [string, string]>>({})

  async function load() {
    try {
      const [c, wps, banks] = await Promise.all([
        api.get(`/api/payroll/company?organizationId=${orgId}`),
        api.get(`/api/payroll/workplaces?organizationId=${orgId}`),
        api.get(`/api/payroll/employer-bank-account?organizationId=${orgId}`),
      ])
      setCompany(c)
      if (c) {
        setForm((f) => ({
          ...f,
          legalBusinessName: c.legalBusinessName, entityType: c.entityType,
          addressLine1: c.addressLine1, addressLine2: c.addressLine2 || '', city: c.city, state: c.state,
          postalCode: c.postalCode, signatoryName: c.signatoryName, signatoryTitle: c.signatoryTitle,
          contactEmail: c.contactEmail, contactPhone: c.contactPhone || '',
        }))
      }
      setWorkplaces(wps)
      setBankAccounts(banks)
    } catch (err: any) {
      onError(err.message)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId])

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    onError(null)
    try {
      const updated = await api.post('/api/payroll/company', { organizationId: orgId, ...form })
      setCompany(updated)
    } catch (err: any) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function submitCompany() {
    onError(null)
    try {
      setCompany(await api.post('/api/payroll/company/submit', { organizationId: orgId }))
    } catch (err: any) {
      onError(err.message)
    }
  }

  async function verifyCompany() {
    onError(null)
    try {
      setCompany(await api.post('/api/payroll/company/verify', { organizationId: orgId }))
    } catch (err: any) {
      onError(err.message)
    }
  }

  async function registerWorkplace(e: React.FormEvent) {
    e.preventDefault()
    setSavingWp(true)
    onError(null)
    try {
      const location = await api.post('/api/locations', { organizationId: orgId, name: wpForm.name })
      await api.post('/api/payroll/workplaces', {
        organizationId: orgId, locationId: location.id, state: wpForm.state,
        sutaAccountNumber: wpForm.sutaAccountNumber || undefined, sutaRate: wpForm.sutaRate || undefined,
      })
      setWpForm({ name: '', state: '', sutaAccountNumber: '', sutaRate: '' })
      await load()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setSavingWp(false)
    }
  }

  async function saveBankAccount(e: React.FormEvent) {
    e.preventDefault()
    setSavingBank(true)
    onError(null)
    try {
      const result = await api.post('/api/payroll/employer-bank-account', { organizationId: orgId, ...bankForm })
      if (result.sandboxMicroDepositAmounts) {
        setMicroDeposits((m) => ({ ...m, [result.id]: result.sandboxMicroDepositAmounts.join(' / ') }))
      }
      setBankForm({ bankName: '', routingNumber: '', accountNumber: '', accountType: 'checking' })
      await load()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setSavingBank(false)
    }
  }

  async function verifyBankAccount(id: string) {
    onError(null)
    const amounts = verifyAmounts[id]
    if (!amounts || !amounts[0] || !amounts[1]) return onError('Enter both micro-deposit amounts')
    try {
      await api.post(`/api/payroll/employer-bank-account/${id}/verify`, { amounts })
      await load()
    } catch (err: any) {
      onError(err.message)
    }
  }

  return (
    <div>
      <Card
        title="Company profile"
        action={
          company?.providerCompanyId ? (
            <button onClick={verifyCompany} className={btnSecondary}>Verify with provider</button>
          ) : company ? (
            <button onClick={submitCompany} className={btnSecondary}>Submit to provider</button>
          ) : null
        }
      >
        {company && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Onboarding status: <span className="font-medium">{company.onboardingStatus}</span>
            {company.providerCompanyId ? ` · Provider company ID: ${company.providerCompanyId}` : ''}
          </p>
        )}
        <form onSubmit={saveCompany} className="grid grid-cols-2 gap-3">
          <Field label="Legal business name"><input required className={inputCls} value={form.legalBusinessName} onChange={(e) => setForm((f) => ({ ...f, legalBusinessName: e.target.value }))} /></Field>
          <Field label="Entity type">
            <select className={inputCls} value={form.entityType} onChange={(e) => setForm((f) => ({ ...f, entityType: e.target.value }))}>
              <option value="sole_proprietor">Sole proprietor</option>
              <option value="llc">LLC</option>
              <option value="c_corp">C corp</option>
              <option value="s_corp">S corp</option>
              <option value="partnership">Partnership</option>
              <option value="nonprofit">Nonprofit</option>
            </select>
          </Field>
          <Field label="EIN"><input className={inputCls} value={form.ein} onChange={(e) => setForm((f) => ({ ...f, ein: e.target.value }))} placeholder="XX-XXXXXXX" /></Field>
          <Field label="Contact email"><input required type="email" className={inputCls} value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} /></Field>
          <Field label="Address line 1"><input required className={inputCls} value={form.addressLine1} onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))} /></Field>
          <Field label="Address line 2"><input className={inputCls} value={form.addressLine2} onChange={(e) => setForm((f) => ({ ...f, addressLine2: e.target.value }))} /></Field>
          <Field label="City"><input required className={inputCls} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></Field>
          <Field label="State"><input required className={inputCls} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} maxLength={2} /></Field>
          <Field label="Postal code"><input required className={inputCls} value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} /></Field>
          <Field label="Contact phone"><input className={inputCls} value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} /></Field>
          <Field label="Signatory name"><input required className={inputCls} value={form.signatoryName} onChange={(e) => setForm((f) => ({ ...f, signatoryName: e.target.value }))} /></Field>
          <Field label="Signatory title"><input required className={inputCls} value={form.signatoryTitle} onChange={(e) => setForm((f) => ({ ...f, signatoryTitle: e.target.value }))} /></Field>
          <div className="col-span-2">
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save company profile'}</button>
          </div>
        </form>
      </Card>

      <Card title="Workplaces (tax jurisdictions)">
        {workplaces.filter((w) => w.isPayrollWorkplace).length > 0 && (
          <table className="w-full text-sm mb-4">
            <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="py-1">Location</th><th className="py-1">State</th><th className="py-1">SUTA account</th><th className="py-1">Provider ID</th></tr>
            </thead>
            <tbody>
              {workplaces.filter((w) => w.isPayrollWorkplace).map((w) => (
                <tr key={w.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="py-1 text-gray-900 dark:text-gray-100">{w.name}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{w.state}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{w.sutaAccountNumber || '—'}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{w.providerWorkplaceId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={registerWorkplace} className="grid grid-cols-4 gap-3 max-w-2xl">
          <Field label="Location name"><input required className={inputCls} value={wpForm.name} onChange={(e) => setWpForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="State"><input required className={inputCls} value={wpForm.state} onChange={(e) => setWpForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} maxLength={2} /></Field>
          <Field label="SUTA account #"><input className={inputCls} value={wpForm.sutaAccountNumber} onChange={(e) => setWpForm((f) => ({ ...f, sutaAccountNumber: e.target.value }))} /></Field>
          <Field label="SUTA rate %"><input className={inputCls} value={wpForm.sutaRate} onChange={(e) => setWpForm((f) => ({ ...f, sutaRate: e.target.value }))} /></Field>
          <div className="col-span-4">
            <button type="submit" disabled={savingWp} className={btnSecondary}>{savingWp ? 'Registering…' : '+ Register workplace'}</button>
          </div>
        </form>
      </Card>

      <Card title="Employer bank account (funding source)">
        {bankAccounts.length > 0 && (
          <table className="w-full text-sm mb-4">
            <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="py-1">Bank</th><th className="py-1">Account</th><th className="py-1">Status</th><th className="py-1">Verify</th></tr>
            </thead>
            <tbody>
              {bankAccounts.map((b) => (
                <tr key={b.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="py-1 text-gray-900 dark:text-gray-100">{b.bankName || '—'}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">••••{b.accountLast4}</td>
                  <td className="py-1">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${b.verificationStatus === 'verified' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {b.verificationStatus}
                    </span>
                  </td>
                  <td className="py-1">
                    {b.verificationStatus !== 'verified' && (
                      <div className="flex items-center gap-1">
                        <input placeholder="0.01" className="w-16 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-1 py-1 text-xs"
                          value={verifyAmounts[b.id]?.[0] || ''}
                          onChange={(e) => setVerifyAmounts((v) => ({ ...v, [b.id]: [e.target.value, v[b.id]?.[1] || ''] }))} />
                        <input placeholder="0.02" className="w-16 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-1 py-1 text-xs"
                          value={verifyAmounts[b.id]?.[1] || ''}
                          onChange={(e) => setVerifyAmounts((v) => ({ ...v, [b.id]: [v[b.id]?.[0] || '', e.target.value] }))} />
                        <button onClick={() => verifyBankAccount(b.id)} className={btnSecondary}>Verify</button>
                      </div>
                    )}
                    {microDeposits[b.id] && (
                      <p className="text-xs text-gray-400 mt-1">Sandbox test amounts: {microDeposits[b.id]}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={saveBankAccount} className="grid grid-cols-4 gap-3 max-w-2xl">
          <Field label="Bank name"><input className={inputCls} value={bankForm.bankName} onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))} /></Field>
          <Field label="Routing number"><input required className={inputCls} value={bankForm.routingNumber} onChange={(e) => setBankForm((f) => ({ ...f, routingNumber: e.target.value }))} /></Field>
          <Field label="Account number"><input required className={inputCls} value={bankForm.accountNumber} onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value }))} /></Field>
          <Field label="Account type">
            <select className={inputCls} value={bankForm.accountType} onChange={(e) => setBankForm((f) => ({ ...f, accountType: e.target.value }))}>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
            </select>
          </Field>
          <div className="col-span-4">
            <button type="submit" disabled={savingBank} className={btnSecondary}>{savingBank ? 'Saving…' : '+ Add bank account'}</button>
          </div>
        </form>
      </Card>
    </div>
  )
}

function EmployeesTab({ orgId, api, onError }: { orgId: string; api: ReturnType<typeof useApi>; onError: (m: string | null) => void }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', payType: 'salary', rate: '' })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [taxForm, setTaxForm] = useState({ filingStatus: 'single', state: '', exemptFromFederal: false, exemptFromState: false })
  const [ddForm, setDdForm] = useState({ routingNumber: '', accountNumber: '', bankName: '', splitType: 'remainder' })
  const [ddResult, setDdResult] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    try {
      setEmployees(await api.get(`/api/employees?organizationId=${orgId}`))
    } catch (err: any) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId])

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    onError(null)
    try {
      await api.post('/api/employees', { organizationId: orgId, ...form })
      setForm({ name: '', email: '', payType: 'salary', rate: '' })
      setShowForm(false)
      await load()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onboard(id: string) {
    onError(null)
    try {
      await api.post(`/api/employees/${id}/onboard`)
      await load()
    } catch (err: any) {
      onError(err.message)
    }
  }

  async function saveTaxProfile(id: string) {
    onError(null)
    try {
      await api.post(`/api/employees/${id}/tax-profile`, taxForm)
    } catch (err: any) {
      onError(err.message)
    }
  }

  async function saveDirectDeposit(id: string) {
    onError(null)
    try {
      const result = await api.post(`/api/employees/${id}/direct-deposit`, ddForm)
      if (result.sandboxMicroDepositAmounts) {
        setDdResult((r) => ({ ...r, [id]: result.sandboxMicroDepositAmounts.join(' / ') }))
      }
    } catch (err: any) {
      onError(err.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Employees</h2>
        <button onClick={() => setShowForm((s) => !s)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
          {showForm ? 'Cancel' : '+ Add employee'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={createEmployee} className="mb-4 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid grid-cols-2 gap-3 max-w-lg">
          <Field label="Name"><input required className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Pay type">
            <select className={inputCls} value={form.payType} onChange={(e) => setForm((f) => ({ ...f, payType: e.target.value }))}>
              <option value="salary">Salary</option>
              <option value="hourly">Hourly</option>
            </select>
          </Field>
          <Field label="Rate"><input required className={inputCls} value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} /></Field>
          <div className="col-span-2">
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save employee'}</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : employees.length === 0 ? (
        <p className="text-sm text-gray-500">No employees yet.</p>
      ) : (
        <div className="space-y-2">
          {employees.map((emp) => (
            <div key={emp.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-midnight-900 dark:text-white">{emp.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {emp.payType} · {currency(emp.rate)}
                    {emp.providerEmployeeId ? ' · Onboarded with provider' : ' · Not onboarded'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!emp.providerEmployeeId && (
                    <button onClick={() => onboard(emp.id)} className={btnSecondary}>Onboard with provider</button>
                  )}
                  <button onClick={() => setExpanded(expanded === emp.id ? null : emp.id)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
                    {expanded === emp.id ? 'Close' : 'Tax & direct deposit'}
                  </button>
                </div>
              </div>
              {expanded === emp.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-midnight-800 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Federal/state withholding</p>
                    <div className="space-y-2">
                      <select className={inputCls} value={taxForm.filingStatus} onChange={(e) => setTaxForm((f) => ({ ...f, filingStatus: e.target.value }))}>
                        <option value="single">Single</option>
                        <option value="married_filing_jointly">Married filing jointly</option>
                        <option value="head_of_household">Head of household</option>
                      </select>
                      <input placeholder="State (e.g. CA)" className={inputCls} value={taxForm.state} onChange={(e) => setTaxForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} maxLength={2} />
                      <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <input type="checkbox" checked={taxForm.exemptFromFederal} onChange={(e) => setTaxForm((f) => ({ ...f, exemptFromFederal: e.target.checked }))} /> Exempt from federal withholding
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <input type="checkbox" checked={taxForm.exemptFromState} onChange={(e) => setTaxForm((f) => ({ ...f, exemptFromState: e.target.checked }))} /> Exempt from state withholding
                      </label>
                      <button onClick={() => saveTaxProfile(emp.id)} className={btnSecondary}>Save tax profile</button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Direct deposit</p>
                    <div className="space-y-2">
                      <input placeholder="Bank name" className={inputCls} value={ddForm.bankName} onChange={(e) => setDdForm((f) => ({ ...f, bankName: e.target.value }))} />
                      <input placeholder="Routing number" className={inputCls} value={ddForm.routingNumber} onChange={(e) => setDdForm((f) => ({ ...f, routingNumber: e.target.value }))} />
                      <input placeholder="Account number" className={inputCls} value={ddForm.accountNumber} onChange={(e) => setDdForm((f) => ({ ...f, accountNumber: e.target.value }))} />
                      <button onClick={() => saveDirectDeposit(emp.id)} className={btnSecondary}>Save direct deposit</button>
                      {ddResult[emp.id] && <p className="text-xs text-gray-400">Sandbox test amounts: {ddResult[emp.id]}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ContractorsTab({ orgId, api, onError }: { orgId: string; api: ReturnType<typeof useApi>; onError: (m: string | null) => void }) {
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', taxIdLast4: '' })
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [ddForm, setDdForm] = useState({ routingNumber: '', accountNumber: '', bankName: '' })
  const [ddResult, setDdResult] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    try {
      setContractors(await api.get(`/api/contractors?organizationId=${orgId}`))
    } catch (err: any) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId])

  async function createContractor(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    onError(null)
    try {
      await api.post('/api/contractors', { organizationId: orgId, ...form })
      setForm({ name: '', email: '', taxIdLast4: '' })
      setShowForm(false)
      await load()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onboard(id: string) {
    onError(null)
    try {
      await api.post(`/api/contractors/${id}/onboard`)
      await load()
    } catch (err: any) {
      onError(err.message)
    }
  }

  async function saveDirectDeposit(id: string) {
    onError(null)
    try {
      const result = await api.post(`/api/contractors/${id}/direct-deposit`, ddForm)
      if (result.sandboxMicroDepositAmounts) {
        setDdResult((r) => ({ ...r, [id]: result.sandboxMicroDepositAmounts.join(' / ') }))
      }
    } catch (err: any) {
      onError(err.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Contractors (1099)</h2>
        <button onClick={() => setShowForm((s) => !s)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
          {showForm ? 'Cancel' : '+ Add contractor'}
        </button>
      </div>
      {showForm && (
        <form onSubmit={createContractor} className="mb-4 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 grid grid-cols-2 gap-3 max-w-lg">
          <Field label="Name"><input required className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
          <Field label="Tax ID last 4 (W-9)"><input className={inputCls} value={form.taxIdLast4} onChange={(e) => setForm((f) => ({ ...f, taxIdLast4: e.target.value }))} maxLength={4} /></Field>
          <div className="col-span-2">
            <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Save contractor'}</button>
          </div>
        </form>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : contractors.length === 0 ? (
        <p className="text-sm text-gray-500">No contractors yet.</p>
      ) : (
        <div className="space-y-2">
          {contractors.map((c) => (
            <div key={c.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-midnight-900 dark:text-white">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    W-9: {c.w9Status}{c.providerContractorId ? ' · Onboarded with provider' : ' · Not onboarded'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!c.providerContractorId && <button onClick={() => onboard(c.id)} className={btnSecondary}>Onboard with provider</button>}
                  <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-xs text-teal-700 dark:text-teal-400 hover:underline">
                    {expanded === c.id ? 'Close' : 'Direct deposit'}
                  </button>
                </div>
              </div>
              {expanded === c.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-midnight-800 space-y-2 max-w-sm">
                  <input placeholder="Bank name" className={inputCls} value={ddForm.bankName} onChange={(e) => setDdForm((f) => ({ ...f, bankName: e.target.value }))} />
                  <input placeholder="Routing number" className={inputCls} value={ddForm.routingNumber} onChange={(e) => setDdForm((f) => ({ ...f, routingNumber: e.target.value }))} />
                  <input placeholder="Account number" className={inputCls} value={ddForm.accountNumber} onChange={(e) => setDdForm((f) => ({ ...f, accountNumber: e.target.value }))} />
                  <button onClick={() => saveDirectDeposit(c.id)} className={btnSecondary}>Save direct deposit</button>
                  {ddResult[c.id] && <p className="text-xs text-gray-400">Sandbox test amounts: {ddResult[c.id]}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PayRunsTab({ orgId, api, onError }: { orgId: string; api: ReturnType<typeof useApi>; onError: (m: string | null) => void }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payRuns, setPayRuns] = useState<PayRun[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const [showRunForm, setShowRunForm] = useState(false)
  const [runForm, setRunForm] = useState({ payPeriodStart: '', payPeriodEnd: '' })
  const [runLines, setRunLines] = useState<{ employeeId: string; grossPay: string }[]>([])
  const [savingRun, setSavingRun] = useState(false)

  const [providerRunId, setProviderRunId] = useState<string | null>(null)
  const [providerForm, setProviderForm] = useState<{ employerTax: string; lines: { lineId: string; employeeTax: string }[] }>({ employerTax: '', lines: [] })
  const [savingProvider, setSavingProvider] = useState(false)

  const [paystubs, setPaystubs] = useState<Record<string, any[]>>({})
  const [showPaystubs, setShowPaystubs] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [emps, runs, appr] = await Promise.all([
        api.get(`/api/employees?organizationId=${orgId}`),
        api.get(`/api/pay-runs?organizationId=${orgId}`),
        api.get(`/api/approvals?organizationId=${orgId}&status=pending`),
      ])
      setEmployees(emps)
      setPayRuns(runs)
      setApprovals(appr.filter((a: Approval) => a.resourceType === 'payroll-run'))
    } catch (err: any) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId])

  function openRunForm() {
    setRunLines(employees.filter((e) => e.active).map((e) => ({ employeeId: e.id, grossPay: '' })))
    setShowRunForm(true)
  }

  async function handleCreateRun(e: React.FormEvent) {
    e.preventDefault()
    const lines = runLines.filter((l) => l.grossPay)
    if (lines.length === 0) return onError('Enter gross pay for at least one employee')
    setSavingRun(true)
    onError(null)
    try {
      await api.post('/api/pay-runs', { organizationId: orgId, ...runForm, lines })
      setRunForm({ payPeriodStart: '', payPeriodEnd: '' })
      setShowRunForm(false)
      await load()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setSavingRun(false)
    }
  }

  async function runAction(id: string, action: string) {
    setBusy(`${id}:${action}`)
    onError(null)
    try {
      await api.post(`/api/pay-runs/${id}/${action}`)
      await load()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function decide(approvalId: string, decision: 'approved' | 'rejected') {
    onError(null)
    try {
      await api.post(`/api/approvals/${approvalId}/decide`, { decision })
      await load()
    } catch (err: any) {
      onError(err.message)
    }
  }

  async function togglePaystubs(id: string) {
    if (showPaystubs === id) return setShowPaystubs(null)
    onError(null)
    try {
      if (!paystubs[id]) {
        const stubs = await api.get(`/api/pay-runs/${id}/paystubs`)
        setPaystubs((p) => ({ ...p, [id]: stubs }))
      }
      setShowPaystubs(id)
    } catch (err: any) {
      onError(err.message)
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
    onError(null)
    try {
      const res = await fetch(`/api/pay-runs/${providerRunId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employerTax: providerForm.employerTax || '0',
          lines: providerForm.lines.map((l) => ({ id: l.lineId, employeeTax: l.employeeTax || '0' })),
        }),
        credentials: 'include',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not save payroll provider totals')
      }
      setProviderRunId(null)
      await load()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setSavingProvider(false)
    }
  }

  async function handlePost(id: string) {
    await runAction(id, 'post')
  }

  return (
    <div>
      {approvals.length > 0 && (
        <Card title="Pending payroll approvals">
          <div className="space-y-2">
            {approvals.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b border-gray-100 dark:border-midnight-800 pb-2 last:border-0">
                <span>Pay run approval · {currency(a.amount)} · requested {new Date(a.createdAt).toLocaleDateString()}</span>
                <div className="flex gap-2">
                  <button onClick={() => decide(a.id, 'approved')} className={btnPrimary}>Approve</button>
                  <button onClick={() => decide(a.id, 'rejected')} className={btnSecondary}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Pay runs</h2>
        <button onClick={openRunForm} disabled={employees.length === 0} className="text-xs text-teal-700 dark:text-teal-400 hover:underline disabled:opacity-50">
          + New pay run
        </button>
      </div>

      {showRunForm && (
        <form onSubmit={handleCreateRun} className="mb-4 bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 max-w-2xl space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pay period start"><input type="date" required className={inputCls} value={runForm.payPeriodStart} onChange={(e) => setRunForm((f) => ({ ...f, payPeriodStart: e.target.value }))} /></Field>
            <Field label="Pay period end"><input type="date" required className={inputCls} value={runForm.payPeriodEnd} onChange={(e) => setRunForm((f) => ({ ...f, payPeriodEnd: e.target.value }))} /></Field>
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
          <button type="submit" disabled={savingRun} className={btnPrimary}>{savingRun ? 'Saving…' : 'Save pay run'}</button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : payRuns.length === 0 ? (
        <p className="text-sm text-gray-500">No pay runs yet.</p>
      ) : (
        <div className="space-y-3">
          {payRuns.map((pr) => (
            <div key={pr.id} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-medium text-midnight-900 dark:text-white">
                    {new Date(pr.payPeriodStart).toLocaleDateString()} – {new Date(pr.payPeriodEnd).toLocaleDateString()}
                    {pr.reversalOfPayRunId ? ' (reversal)' : ''}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {pr.lines.length} employees &middot; {currency(pr.totalGross)} gross
                    {Number(pr.totalEmployeeTax) > 0 || Number(pr.totalEmployerTax) > 0 ? (
                      <> &middot; {currency(pr.totalEmployeeTax)} employee tax &middot; {currency(pr.totalEmployerTax)} employer tax &middot; {currency(pr.totalNetPay)} net pay</>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-midnight-800 dark:text-gray-300">
                    {pr.status}
                  </span>
                  {['draft', 'needs_attention'].includes(pr.status) && (
                    <button onClick={() => runAction(pr.id, 'calculate')} disabled={busy === `${pr.id}:calculate`} className={btnPrimary}>
                      {busy === `${pr.id}:calculate` ? 'Calculating…' : 'Calculate via provider'}
                    </button>
                  )}
                  {pr.status === 'calculated' && (
                    <button onClick={() => runAction(pr.id, 'submit-for-approval')} disabled={busy === `${pr.id}:submit-for-approval`} className={btnPrimary}>
                      Submit for approval
                    </button>
                  )}
                  {['submitted', 'processing'].includes(pr.status) && (
                    <>
                      <button onClick={() => runAction(pr.id, 'sync')} disabled={busy === `${pr.id}:sync`} className={btnSecondary}>Sync status</button>
                      <button onClick={() => runAction(pr.id, 'void')} disabled={busy === `${pr.id}:void`} className={btnSecondary}>Void</button>
                    </>
                  )}
                  {['draft', 'calculating', 'calculated', 'needs_attention', 'awaiting_approval'].includes(pr.status) && (
                    <button onClick={() => runAction(pr.id, 'cancel')} disabled={busy === `${pr.id}:cancel`} className={btnSecondary}>Cancel</button>
                  )}
                  {pr.status === 'completed' && (
                    <>
                      <button onClick={() => togglePaystubs(pr.id)} className={btnSecondary}>{showPaystubs === pr.id ? 'Hide paystubs' : 'View paystubs'}</button>
                      <button onClick={() => runAction(pr.id, 'reverse')} disabled={busy === `${pr.id}:reverse`} className={btnSecondary}>Reverse</button>
                    </>
                  )}
                  {pr.status === 'draft' && (
                    <>
                      <button onClick={() => openProviderForm(pr)} className={btnSecondary}>Enter provider totals</button>
                      <button onClick={() => handlePost(pr.id)} disabled={busy === `${pr.id}:post`} className={btnPrimary}>Post to ledger</button>
                    </>
                  )}
                </div>
              </div>

              {showPaystubs === pr.id && (
                <div className="mt-4 border-t border-gray-100 dark:border-midnight-800 pt-4">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Paystubs</p>
                  {(paystubs[pr.id] || []).length === 0 ? (
                    <p className="text-xs text-gray-500">No paystubs generated yet.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        <tr><th className="py-1">Employee</th><th className="py-1 text-right">Gross</th><th className="py-1 text-right">Tax</th><th className="py-1 text-right">Net</th><th className="py-1">Pay date</th></tr>
                      </thead>
                      <tbody>
                        {(paystubs[pr.id] || []).map((s: any) => (
                          <tr key={s.id} className="border-t border-gray-100 dark:border-midnight-800">
                            <td className="py-1 text-gray-900 dark:text-gray-100">{s.payRunLine?.employee?.name || s.employeeId}</td>
                            <td className="py-1 text-right text-gray-500 dark:text-gray-400">{currency(s.payRunLine?.grossPay)}</td>
                            <td className="py-1 text-right text-gray-500 dark:text-gray-400">{currency(s.payRunLine?.employeeTax)}</td>
                            <td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(s.payRunLine?.netPay)}</td>
                            <td className="py-1 text-gray-500 dark:text-gray-400">{new Date(s.payDate).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {providerRunId === pr.id && (
                <form onSubmit={handleSaveProviderTotals} className="mt-4 border-t border-gray-100 dark:border-midnight-800 pt-4 space-y-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Fallback: enter the results from a licensed payroll provider's report for this pay period manually.
                  </p>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      <tr><th className="py-1">Employee</th><th className="py-1 text-right">Gross pay</th><th className="py-1 text-right">Tax withholding</th><th className="py-1 text-right">Net pay</th></tr>
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
                    <Field label="Employer payroll tax expense (total)">
                      <input value={providerForm.employerTax} onChange={(e) => setProviderForm((f) => ({ ...f, employerTax: e.target.value }))} className={inputCls} />
                    </Field>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={savingProvider} className={btnPrimary}>{savingProvider ? 'Saving…' : 'Save totals'}</button>
                    <button type="button" onClick={() => setProviderRunId(null)} className={btnSecondary}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TaxCenterTab({ orgId, api, onError }: { orgId: string; api: ReturnType<typeof useApi>; onError: (m: string | null) => void }) {
  const [liabilities, setLiabilities] = useState<TaxFiling[]>([])
  const [filings, setFilings] = useState<TaxFiling[]>([])
  const [documents, setDocuments] = useState<TaxDocument[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()))
  const [paymentAccount, setPaymentAccount] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const [liab, fil, docs, accts] = await Promise.all([
        api.get(`/api/payroll/tax-liabilities?organizationId=${orgId}`),
        api.get(`/api/payroll/tax-filings?organizationId=${orgId}`),
        api.get(`/api/payroll/tax-documents?organizationId=${orgId}&taxYear=${taxYear}`),
        api.get(`/api/accounts?organizationId=${orgId}`),
      ])
      setLiabilities(liab)
      setFilings(fil)
      setDocuments(docs)
      setAccounts(accts)
    } catch (err: any) {
      onError(err.message)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId])

  async function syncLiabilities() {
    setBusy('liabilities')
    onError(null)
    try {
      await api.post('/api/payroll/tax-liabilities', { organizationId: orgId })
      await load()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function syncFilings() {
    setBusy('filings')
    onError(null)
    try {
      await api.post('/api/payroll/tax-filings', { organizationId: orgId })
      await load()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function syncDocuments() {
    setBusy('documents')
    onError(null)
    try {
      await api.post('/api/payroll/tax-documents', { organizationId: orgId, taxYear: Number(taxYear) })
      await load()
    } catch (err: any) {
      onError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function payFiling(id: string) {
    onError(null)
    const paymentAccountId = paymentAccount[id]
    if (!paymentAccountId) return onError('Select a payment account first')
    try {
      await api.post(`/api/payroll/tax-filings/${id}/pay`, { paymentAccountId })
      await load()
    } catch (err: any) {
      onError(err.message)
    }
  }

  return (
    <div>
      <Card title="Outstanding tax liabilities" action={<button onClick={syncLiabilities} disabled={busy === 'liabilities'} className={btnSecondary}>{busy === 'liabilities' ? 'Syncing…' : 'Sync from provider'}</button>}>
        {liabilities.length === 0 ? (
          <p className="text-sm text-gray-500">No outstanding liabilities on file.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="py-1">Jurisdiction</th><th className="py-1">Form</th><th className="py-1">Due date</th><th className="py-1 text-right">Amount</th><th className="py-1">Status</th><th className="py-1">Pay</th></tr>
            </thead>
            <tbody>
              {liabilities.map((l) => (
                <tr key={l.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="py-1 text-gray-900 dark:text-gray-100">{l.jurisdiction}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{l.formType}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{new Date(l.dueDate).toLocaleDateString()}</td>
                  <td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(l.amount)}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{l.status}</td>
                  <td className="py-1">
                    {l.status !== 'paid' && (
                      <div className="flex items-center gap-1">
                        <select className="rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-1 py-1 text-xs"
                          value={paymentAccount[l.id] || ''} onChange={(e) => setPaymentAccount((p) => ({ ...p, [l.id]: e.target.value }))}>
                          <option value="">Account…</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                        </select>
                        <button onClick={() => payFiling(l.id)} className={btnSecondary}>Mark paid</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Tax filings" action={<button onClick={syncFilings} disabled={busy === 'filings'} className={btnSecondary}>{busy === 'filings' ? 'Syncing…' : 'Sync from provider'}</button>}>
        {filings.length === 0 ? (
          <p className="text-sm text-gray-500">No filings on file.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="py-1">Jurisdiction</th><th className="py-1">Form</th><th className="py-1">Due date</th><th className="py-1">Status</th></tr>
            </thead>
            <tbody>
              {filings.map((f) => (
                <tr key={f.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="py-1 text-gray-900 dark:text-gray-100">{f.jurisdiction}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{f.formType}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{new Date(f.dueDate).toLocaleDateString()}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{f.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card
        title="Tax documents (W-2 / 1099)"
        action={
          <div className="flex items-center gap-2">
            <input className="w-20 rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-2 py-1 text-xs" value={taxYear} onChange={(e) => setTaxYear(e.target.value)} />
            <button onClick={syncDocuments} disabled={busy === 'documents'} className={btnSecondary}>{busy === 'documents' ? 'Syncing…' : 'Sync from provider'}</button>
          </div>
        }
      >
        {documents.length === 0 ? (
          <p className="text-sm text-gray-500">No tax documents on file for {taxYear}.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              <tr><th className="py-1">Owner</th><th className="py-1">Document</th><th className="py-1">Tax year</th><th className="py-1">Status</th></tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} className="border-t border-gray-100 dark:border-midnight-800">
                  <td className="py-1 text-gray-900 dark:text-gray-100">{d.ownerType}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{d.documentType}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{d.taxYear}</td>
                  <td className="py-1 text-gray-500 dark:text-gray-400">{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

function ReportsTab({ orgId, api, onError }: { orgId: string; api: ReturnType<typeof useApi>; onError: (m: string | null) => void }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    onError(null)
    try {
      const params = new URLSearchParams({ organizationId: orgId })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      setReport(await api.get(`/api/reports/payroll-summary?${params.toString()}`))
    } catch (err: any) {
      onError(err.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId])

  return (
    <div>
      <Card title="Payroll summary">
        <div className="flex items-end gap-3 mb-4">
          <Field label="Start date"><input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
          <Field label="End date"><input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
          <button onClick={load} disabled={loading} className={btnSecondary}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
        {report && (
          <>
            <table className="w-full text-sm mb-4">
              <tbody>
                <tr><td className="py-1 text-gray-500 dark:text-gray-400">Total gross</td><td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(report.totals.totalGross)}</td></tr>
                <tr><td className="py-1 text-gray-500 dark:text-gray-400">Employee tax</td><td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(report.totals.totalEmployeeTax)}</td></tr>
                <tr><td className="py-1 text-gray-500 dark:text-gray-400">Employer tax</td><td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(report.totals.totalEmployerTax)}</td></tr>
                <tr><td className="py-1 text-gray-500 dark:text-gray-400">Deductions (pretax + posttax)</td><td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(report.totals.totalPretaxDeductions + report.totals.totalPosttaxDeductions)}</td></tr>
                <tr><td className="py-1 text-gray-500 dark:text-gray-400">Garnishments</td><td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(report.totals.totalGarnishments)}</td></tr>
                <tr><td className="py-1 text-gray-500 dark:text-gray-400">Reimbursements</td><td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(report.totals.totalReimbursements)}</td></tr>
                <tr><td className="py-1 text-gray-500 dark:text-gray-400">Employer benefits cost</td><td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(report.totals.totalEmployerBenefitsCost)}</td></tr>
                <tr className="border-t border-gray-200 dark:border-midnight-800"><td className="py-1 font-medium text-gray-900 dark:text-gray-100">Net pay</td><td className="py-1 text-right font-medium text-gray-900 dark:text-gray-100">{currency(report.totals.totalNetPay)}</td></tr>
              </tbody>
            </table>
            <div className="border-t border-gray-100 dark:border-midnight-800 pt-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Payroll tax liability reconciliation</p>
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="py-1 text-gray-500 dark:text-gray-400">Payroll Taxes Payable (ledger)</td><td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(report.taxLiabilityReconciliation.ledgerBalance)}</td></tr>
                  <tr><td className="py-1 text-gray-500 dark:text-gray-400">Outstanding provider filings</td><td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(report.taxLiabilityReconciliation.outstandingFilingsTotal)}</td></tr>
                  <tr><td className="py-1 font-medium text-gray-500 dark:text-gray-400">Variance</td><td className="py-1 text-right font-medium text-gray-900 dark:text-gray-100">{currency(report.taxLiabilityReconciliation.difference)}</td></tr>
                </tbody>
              </table>
            </div>
            <table className="w-full text-sm mt-4">
              <thead className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                <tr><th className="py-1">Period</th><th className="py-1">Status</th><th className="py-1 text-right">Gross</th><th className="py-1 text-right">Net pay</th></tr>
              </thead>
              <tbody>
                {report.payRuns.map((pr: any) => (
                  <tr key={pr.id} className="border-t border-gray-100 dark:border-midnight-800">
                    <td className="py-1 text-gray-900 dark:text-gray-100">{new Date(pr.payPeriodStart).toLocaleDateString()} – {new Date(pr.payPeriodEnd).toLocaleDateString()}</td>
                    <td className="py-1 text-gray-500 dark:text-gray-400">{pr.status}</td>
                    <td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(pr.totalGross)}</td>
                    <td className="py-1 text-right text-gray-900 dark:text-gray-100">{currency(pr.totalNetPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  )
}

function PayrollContent() {
  const { token, currentOrg } = useAuth()
  const api = useApi(token)
  const [tab, setTab] = useState<Tab>('Setup')
  const [error, setError] = useState<string | null>(null)

  if (!currentOrg) return null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">Payroll</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg.name}</p>
      </div>

      <div className="mb-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        <strong>Full-service Lumviq Payroll is in sandbox development.</strong> No real payments or tax filings will
        occur. This page exercises the complete provider-backed payroll lifecycle — company/employee onboarding,
        calculation, approval, direct deposit, tax liabilities/filings/documents, and ledger posting — against a
        sandbox payroll provider. A licensed payroll provider must be contracted and connected before any of this
        can run against real money or real tax agencies (see <a className="underline" href="/settings/integrations">Settings → Integrations</a>).
        The manual "Enter provider totals" flow remains available on the Pay runs tab as a fallback for
        organizations without a connected provider.
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="mb-6 border-b border-gray-200 dark:border-midnight-800 flex gap-4">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm pb-2 border-b-2 -mb-px ${tab === t ? 'border-teal-600 text-teal-700 dark:text-teal-400 font-medium' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Setup' && <SetupTab orgId={currentOrg.id} api={api} onError={setError} />}
      {tab === 'Employees' && <EmployeesTab orgId={currentOrg.id} api={api} onError={setError} />}
      {tab === 'Contractors' && <ContractorsTab orgId={currentOrg.id} api={api} onError={setError} />}
      {tab === 'Pay runs' && <PayRunsTab orgId={currentOrg.id} api={api} onError={setError} />}
      {tab === 'Tax center' && <TaxCenterTab orgId={currentOrg.id} api={api} onError={setError} />}
      {tab === 'Reports' && <ReportsTab orgId={currentOrg.id} api={api} onError={setError} />}
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

