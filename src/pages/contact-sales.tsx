import React, { useState } from 'react'
import MarketingLayout from '../components/marketing/MarketingLayout'
import { brand } from '../lib/brand'
import { track } from '../lib/analytics'
import { validateContactSales, ContactSalesInput } from '../lib/contact-sales'
import { PLATFORM_MODULES } from '../lib/marketing-content'

const EMPLOYEE_RANGES = ['1', '2-10', '11-50', '51-200', '201+']
const PREFERRED_CONTACT_OPTIONS = ['Email', 'Phone', 'Either']

export default function ContactSalesPage() {
  const [form, setForm] = useState<ContactSalesInput>({ requiredModules: [] })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  function set<K extends keyof ContactSalesInput>(key: K, value: ContactSalesInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleModule(key: string) {
    setForm((f) => {
      const current = f.requiredModules || []
      const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
      return { ...f, requiredModules: next }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    const result = validateContactSales(form)
    setErrors(result.errors)
    if (!result.ok) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/contact-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErrors(body.errors || {})
        setServerError(body.error || 'Something went wrong. Please try again.')
        return
      }
      track('contact_sales_submitted', { organizationType: form.organizationType })
      setSubmitted(true)
    } catch {
      setServerError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <MarketingLayout title="Contact Sales" description="Talk to the Lumviq sales team." path="/contact-sales">
        <section className="max-w-lg mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-semibold text-midnight-900 dark:text-white">Thanks — we&rsquo;ll be in touch.</h1>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            A member of our team will reach out using the contact details you provided.
          </p>
        </section>
      </MarketingLayout>
    )
  }

  return (
    <MarketingLayout
      title="Contact Sales"
      description={`Talk to the ${brand.name} sales team about your organization's needs.`}
      path="/contact-sales"
    >
      <section className="max-w-2xl mx-auto px-4 pt-16 pb-20">
        <h1 className="text-3xl md:text-4xl font-semibold text-midnight-900 dark:text-white text-center">Talk to Sales</h1>
        <p className="mt-4 text-center text-gray-600 dark:text-gray-400">
          Tell us about your organization and we&rsquo;ll help you find the right plan.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-5" noValidate>
          {serverError && (
            <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {serverError}
            </div>
          )}

          {/* Honeypot field, hidden from real users */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website || ''} onChange={(e) => set('website', e.target.value)} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">First name</label>
              <input
                id="firstName"
                value={form.firstName || ''}
                onChange={(e) => set('firstName', e.target.value)}
                aria-invalid={!!errors.firstName}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last name</label>
              <input
                id="lastName"
                value={form.lastName || ''}
                onChange={(e) => set('lastName', e.target.value)}
                aria-invalid={!!errors.lastName}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Business email</label>
            <input
              id="email"
              type="email"
              value={form.email || ''}
              onChange={(e) => set('email', e.target.value)}
              aria-invalid={!!errors.email}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone <span className="text-gray-400">(optional)</span></label>
            <input
              id="phone"
              value={form.phone || ''}
              onChange={(e) => set('phone', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organization name</label>
            <input
              id="organizationName"
              value={form.organizationName || ''}
              onChange={(e) => set('organizationName', e.target.value)}
              aria-invalid={!!errors.organizationName}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
            />
            {errors.organizationName && <p className="mt-1 text-xs text-red-600">{errors.organizationName}</p>}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="organizationType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Organization type</label>
              <select
                id="organizationType"
                value={form.organizationType || ''}
                onChange={(e) => set('organizationType', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
              >
                <option value="">Select one</option>
                <option value="business">Business</option>
                <option value="nonprofit">Nonprofit</option>
              </select>
            </div>
            <div>
              <label htmlFor="employeeCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Employees</label>
              <select
                id="employeeCount"
                value={form.employeeCount || ''}
                onChange={(e) => set('employeeCount', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
              >
                <option value="">Select one</option>
                {EMPLOYEE_RANGES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="currentSystem" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Current accounting system <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="currentSystem"
              value={form.currentSystem || ''}
              onChange={(e) => set('currentSystem', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
            />
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Modules you&rsquo;re interested in <span className="text-gray-400">(optional)</span>
            </legend>
            <div className="grid sm:grid-cols-2 gap-2">
              {PLATFORM_MODULES.map((m) => (
                <label key={m.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={(form.requiredModules || []).includes(m.key)}
                    onChange={() => toggleModule(m.key)}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preferred contact method</legend>
            <div className="flex gap-4">
              {PREFERRED_CONTACT_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    name="preferredContact"
                    checked={form.preferredContact === opt}
                    onChange={() => set('preferredContact', opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Anything else we should know? <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="message"
              rows={4}
              value={form.message || ''}
              onChange={(e) => set('message', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 dark:border-midnight-700 bg-white dark:bg-midnight-800 dark:text-gray-100 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={!!form.consentAcknowledged}
              onChange={(e) => set('consentAcknowledged', e.target.checked)}
              aria-invalid={!!errors.consentAcknowledged}
              className="mt-0.5"
            />
            <span>I agree to be contacted by the Lumviq sales team about my inquiry.</span>
          </label>
          {errors.consentAcknowledged && <p className="text-xs text-red-600">{errors.consentAcknowledged}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-teal-600 text-white py-2.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send to sales'}
          </button>
        </form>
      </section>
    </MarketingLayout>
  )
}
