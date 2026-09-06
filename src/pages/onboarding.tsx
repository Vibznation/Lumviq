import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { brand } from '../lib/brand'
import { authHeaders, useAuth } from '../lib/auth-context'
import { PLANS } from '../lib/plans'

export default function OnboardingPage() {
  const router = useRouter()
  const { token, organizations, refresh, setCurrentOrgId, loading } = useAuth()
  const [name, setName] = useState('')
  const [orgType, setOrgType] = useState<'business' | 'nonprofit'>('business')
  const [industry, setIndustry] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const planId = typeof router.query.plan === 'string' ? router.query.plan : 'free'
  const billingCycle = router.query.billing === 'annual' ? 'annual' : 'monthly'
  const addOns = typeof router.query.addons === 'string' && router.query.addons.length > 0 ? router.query.addons.split(',') : []
  const selectedPlan = PLANS.find((p) => p.id === planId)

  if (!loading && !token) {
    if (typeof window !== 'undefined') router.replace('/login')
    return null
  }

  if (!loading && organizations.length > 0) {
    if (typeof window !== 'undefined') router.replace('/dashboard')
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/orgs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ name, orgType, industry: industry || undefined, planId, billingCycle, addOns }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Could not create organization')
        return
      }
      const org = await res.json()
      await refresh()
      setCurrentOrgId(org.id)
      router.push('/dashboard')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-midnight-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-midnight-800 dark:text-white">Create or join an organization</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {brand.name} will generate a starting chart of accounts and the current fiscal year for you.
          </p>
          {selectedPlan && (
            <p className="text-xs text-teal-700 dark:text-teal-400 mt-2">
              Starting on {selectedPlan.name} ({billingCycle}). <a href="/pricing" className="underline">Change plan</a>
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-lg p-6 space-y-4">
          {error && (
            <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Organization name
            </label>
            <input
              id="orgName"
              name="orgName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
            />
          </div>
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organization type</legend>
            <div className="mt-2 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="orgType"
                  checked={orgType === 'business'}
                  onChange={() => setOrgType('business')}
                />
                Business
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="orgType"
                  checked={orgType === 'nonprofit'}
                  onChange={() => setOrgType('nonprofit')}
                />
                Nonprofit
              </label>
            </div>
          </fieldset>
          <div>
            <label htmlFor="industry" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Industry <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="industry"
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Professional services"
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-teal-600 text-white py-2 text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create organization'}
          </button>
        </form>
      </div>
    </div>
  )
}
