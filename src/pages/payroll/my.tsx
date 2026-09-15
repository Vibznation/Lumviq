import React, { useEffect, useState } from 'react'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'

type MyProfile = {
  employee: {
    id: string
    name: string
    email: string | null
    payType: string
    rate: string
    active: boolean
    onboardingStatus?: string
  }
  taxProfile: {
    filingStatus: string
    federalAllowances: number | null
    state: string | null
    stateFilingStatus: string | null
    exemptFromFederal: boolean
    exemptFromState: boolean
  } | null
  directDeposits: {
    id: string
    bankName: string | null
    accountType: string
    accountLast4: string
    splitType: string
    splitValue: string | null
    verificationStatus: string
    active: boolean
  }[]
}

type PayStub = {
  id: string
  payDate: string
  payRun: { payPeriodStart: string; payPeriodEnd: string; offCycle: boolean }
  payRunLine: { grossPay: string; employeeTax: string; netPay: string }
}

function currency(n: string | number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function MyPayrollContent() {
  const { token, currentOrg } = useAuth()
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [payStubs, setPayStubs] = useState<PayStub[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    Promise.all([
      fetch(`/api/payroll/my?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
      fetch(`/api/payroll/my/paystubs?organizationId=${currentOrg.id}`, { headers: authHeaders(token) }),
    ])
      .then(async ([pRes, sRes]) => {
        if (pRes.status === 404) {
          setProfile(null)
          setPayStubs([])
          return
        }
        if (!pRes.ok) throw new Error('Could not load your payroll profile')
        setProfile(await pRes.json())
        setPayStubs(sRes.ok ? await sRes.json() : [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [currentOrg?.id, token])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-midnight-900 dark:text-white">My payroll</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{currentOrg?.name}</p>
      </div>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !profile ? (
        <p className="text-sm text-gray-500">
          No employee record is linked to your account in this organization. Contact your administrator if you
          believe this is a mistake.
        </p>
      ) : (
        <>
          <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Profile</h2>
            <p className="text-sm text-gray-900 dark:text-gray-100">{profile.employee.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {profile.employee.payType} · {currency(profile.employee.rate)}
            </p>
            {profile.taxProfile && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Filing status: {profile.taxProfile.filingStatus}
                {profile.taxProfile.state ? ` · State: ${profile.taxProfile.state}` : ''}
              </p>
            )}
          </div>

          {profile.directDeposits.length > 0 && (
            <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Direct deposit</h2>
              {profile.directDeposits.map((d) => (
                <p key={d.id} className="text-sm text-gray-900 dark:text-gray-100">
                  {d.bankName || 'Bank'} ••••{d.accountLast4} ({d.accountType}) — {d.verificationStatus}
                </p>
              ))}
            </div>
          )}

          <div className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg overflow-hidden">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 p-4 pb-0">Paystubs</h2>
            {payStubs.length === 0 ? (
              <p className="text-sm text-gray-500 p-4">No paystubs yet.</p>
            ) : (
              <table className="w-full text-sm mt-2">
                <thead className="bg-gray-50 dark:bg-midnight-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-2">Pay period</th>
                    <th className="px-4 py-2">Pay date</th>
                    <th className="px-4 py-2 text-right">Gross</th>
                    <th className="px-4 py-2 text-right">Tax</th>
                    <th className="px-4 py-2 text-right">Net pay</th>
                  </tr>
                </thead>
                <tbody>
                  {payStubs.map((s) => (
                    <tr key={s.id} className="border-t border-gray-100 dark:border-midnight-800">
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">
                        {new Date(s.payRun.payPeriodStart).toLocaleDateString()} – {new Date(s.payRun.payPeriodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{new Date(s.payDate).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">{currency(s.payRunLine.grossPay)}</td>
                      <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">{currency(s.payRunLine.employeeTax)}</td>
                      <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{currency(s.payRunLine.netPay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function MyPayrollPage() {
  return (
    <ProtectedRoute>
      <MyPayrollContent />
    </ProtectedRoute>
  )
}
