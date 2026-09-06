import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import { authHeaders, useAuth } from '../../lib/auth-context'
import { PLANS, ADD_ONS, BillingCycle, planMonthlyEquivalent } from '../../lib/plans'

interface BillingState {
  planId: string
  billingCycle: BillingCycle
  addOns: string[]
  featureKeys: string[]
}

function BillingSettingsContent() {
  const { token, currentOrg } = useAuth()
  const [state, setState] = useState<BillingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const isOwner = currentOrg?.role === 'owner'

  async function load() {
    if (!currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/billing/plan?organizationId=${currentOrg.id}`, { headers: authHeaders(token) })
      if (!res.ok) throw new Error('Could not load billing information')
      setState(await res.json())
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

  async function changePlan(planId: string, billingCycle: BillingCycle) {
    if (!currentOrg || !state) return
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/billing/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ organizationId: currentOrg.id, planId, billingCycle, addOns: state.addOns }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not update plan')
      }
      setStatus('Plan updated.')
      await load()
    } catch (err: any) {
      setStatus(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-midnight-900 dark:text-white mb-1">Billing</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{currentOrg?.name}</p>

      {error && (
        <div role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading || !state ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Current plan</h2>
            <div className="rounded-lg border border-gray-200 dark:border-midnight-800 p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-midnight-900 dark:text-white">
                  {PLANS.find((p) => p.id === state.planId)?.name || state.planId}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Billed {state.billingCycle}</p>
              </div>
              <Link href="/pricing" className="text-sm text-teal-700 dark:text-teal-400 hover:underline">
                Compare plans
              </Link>
            </div>
          </section>

          {isOwner ? (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Change plan</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PLANS.map((p) => {
                  const monthlyEquivalent = planMonthlyEquivalent(p.id, state.billingCycle)
                  const active = p.id === state.planId
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={saving || active}
                      onClick={() => changePlan(p.id, state.billingCycle)}
                      className={
                        'text-left rounded-lg border p-3 disabled:opacity-60 ' +
                        (active ? 'border-teal-500 ring-1 ring-teal-500' : 'border-gray-200 dark:border-midnight-800')
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-midnight-800 dark:text-white">{p.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {monthlyEquivalent === null ? 'Custom' : `$${monthlyEquivalent}/mo`}
                        </span>
                      </div>
                      {active && <span className="text-xs text-teal-700 dark:text-teal-400">Current plan</span>}
                    </button>
                  )
                })}
              </div>
              {status && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{status}</p>}
              <p className="mt-3 text-xs text-gray-400">
                Downgrading never deletes your historical data — it only changes what new actions are available going forward.
              </p>
            </section>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Only an organization owner can change the plan.</p>
          )}

          <section>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Add-ons</h2>
            {state.addOns.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No add-ons enabled.</p>
            ) : (
              <ul className="space-y-2">
                {state.addOns.map((id) => {
                  const addOn = ADD_ONS.find((a) => a.id === id)
                  return (
                    <li key={id} className="rounded-lg border border-gray-200 dark:border-midnight-800 p-3 text-sm text-gray-700 dark:text-gray-300">
                      {addOn?.name || id}
                    </li>
                  )
                })}
              </ul>
            )}
            <Link href="/pricing#addons" className="mt-3 inline-block text-sm text-teal-700 dark:text-teal-400 hover:underline">
              Manage add-ons on the pricing page
            </Link>
          </section>
        </>
      )}
    </div>
  )
}

export default function BillingSettingsPage() {
  return (
    <ProtectedRoute>
      <BillingSettingsContent />
    </ProtectedRoute>
  )
}
