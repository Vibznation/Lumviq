import React from 'react'
import Link from 'next/link'
import { Plan, BillingCycle, planMonthlyEquivalent, planPrice } from '../../lib/plans'

export default function PricingCard({
  plan,
  cycle,
  ctaHref,
  ctaLabel,
}: {
  plan: Plan
  cycle: BillingCycle
  ctaHref: string
  ctaLabel: string
}) {
  const monthlyEquivalent = planMonthlyEquivalent(plan.id, cycle)
  const charged = planPrice(plan.id, cycle)

  return (
    <div
      className={
        'flex flex-col rounded-xl border p-6 bg-white dark:bg-midnight-900 ' +
        (plan.mostPopular
          ? 'border-teal-500 ring-2 ring-teal-500'
          : 'border-gray-200 dark:border-midnight-800')
      }
    >
      {plan.mostPopular && (
        <span className="self-start mb-3 rounded-full bg-teal-600 text-white text-xs font-semibold px-3 py-1">
          Most Popular
        </span>
      )}
      <h3 className="text-lg font-semibold text-midnight-800 dark:text-white">{plan.name}</h3>
      <div className="mt-2">
        {monthlyEquivalent === null ? (
          <span className="text-3xl font-semibold text-midnight-900 dark:text-white">Custom</span>
        ) : (
          <>
            <span className="text-3xl font-semibold text-midnight-900 dark:text-white">${monthlyEquivalent}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400"> / month</span>
          </>
        )}
      </div>
      {cycle === 'annual' && charged !== null && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Billed ${charged} annually</p>
      )}
      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{plan.designedFor.join(' \u00b7 ')}</p>
      <ul className="mt-4 space-y-2 flex-1">
        {plan.highlights.map((h) => (
          <li key={h} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
            <span aria-hidden="true" className="text-teal-600">&#10003;</span>
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={
          'mt-6 block text-center rounded-md px-4 py-2 text-sm font-medium ' +
          (plan.mostPopular
            ? 'bg-teal-600 text-white hover:bg-teal-700'
            : 'border border-gray-300 dark:border-midnight-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-midnight-800')
        }
      >
        {ctaLabel}
      </Link>
    </div>
  )
}
