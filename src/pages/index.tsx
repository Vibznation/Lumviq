import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import MarketingLayout from '../components/marketing/MarketingLayout'
import ProductTour from '../components/marketing/ProductTour'
import PricingCard from '../components/marketing/PricingCard'
import FAQAccordion from '../components/marketing/FAQAccordion'
import { brand } from '../lib/brand'
import { useAuth } from '../lib/auth-context'
import { track } from '../lib/analytics'
import { PLANS } from '../lib/plans'
import {
  TRUST_STATEMENTS,
  VALUE_PILLARS,
  ACCOUNTANT_COLLABORATION,
  INTEGRATION_CATEGORIES,
  SECURITY_HIGHLIGHTS,
  FAQ_ITEMS,
} from '../lib/marketing-content'

function Section({ id, className, children }: { id?: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={'max-w-6xl mx-auto px-4 py-16 ' + (className || '')}>
      {children}
    </section>
  )
}

export default function Home() {
  const router = useRouter()
  const { token, loading } = useAuth()

  useEffect(() => {
    if (!loading && token) {
      router.replace('/dashboard')
    }
  }, [loading, token, router])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  return (
    <MarketingLayout
      title={`${brand.name} — Complete accounting. Clear decisions.`}
      description="Lumviq brings your books, banking, invoices, bills, payroll, inventory, projects and planning into one intelligent, human-controlled accounting platform."
      path="/"
      jsonLd={jsonLd}
    >
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-midnight-900 via-midnight-800 to-teal-900">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(13,196,174,0.35),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(234,171,48,0.25),transparent_40%)]"
        />
        <Section className="relative pt-24 pb-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-teal-200 ring-1 ring-inset ring-white/20">
            <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden="true" />
            Welcome to {brand.name}
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl font-semibold text-white max-w-3xl mx-auto">
            Complete accounting. <span className="text-teal-300">Clear decisions.</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-200">
            {brand.name} brings your books, banking, invoices, bills, payroll, inventory, projects and planning into one
            intelligent platform that stays simple as your business grows.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              onClick={() => track('cta_click', { cta: 'start_free', location: 'hero' })}
              className="rounded-md bg-teal-500 text-midnight-950 px-6 py-3 font-semibold shadow-lg shadow-teal-500/20 hover:bg-teal-400"
            >
              Start Free
            </Link>
            <Link
              href="/pricing"
              onClick={() => track('cta_click', { cta: 'see_plans', location: 'hero' })}
              className="rounded-md border border-white/30 px-6 py-3 font-medium text-white hover:bg-white/10"
            >
              See Plans
            </Link>
          </div>

          <div className="mt-16 max-w-4xl mx-auto rounded-2xl border border-white/10 bg-white dark:bg-midnight-900 p-6 text-left shadow-2xl">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Financial overview &middot; demo organization</p>
            <ProductTour />
          </div>
        </Section>
      </section>


      {/* Trust strip */}
      <Section className="py-10 border-t border-gray-100 dark:border-midnight-900">
        <ul className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          {TRUST_STATEMENTS.map((t) => (
            <li key={t} className="text-sm font-medium text-gray-600 dark:text-gray-400">{t}</li>
          ))}
        </ul>
      </Section>

      {/* Value pillars */}
      <Section>
        <h2 className="text-2xl md:text-3xl font-semibold text-midnight-900 dark:text-white text-center">
          Everything you need, working together
        </h2>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {VALUE_PILLARS.map((v) => (
            <div key={v.title} className="rounded-xl border border-gray-200 dark:border-midnight-800 p-6">
              <h3 className="font-semibold text-midnight-800 dark:text-white">{v.title}</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{v.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Pricing preview */}
      <Section className="border-t border-gray-100 dark:border-midnight-900">
        <h2 className="text-2xl md:text-3xl font-semibold text-midnight-900 dark:text-white text-center">Plans for every stage</h2>
        <div className="mt-10 grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          {PLANS.map((p) => (
            <PricingCard key={p.id} plan={p} cycle="monthly" ctaHref="/pricing" ctaLabel={p.monthlyPrice === null ? 'Contact sales' : 'View plan'} />
          ))}
        </div>
        <p className="text-center mt-6">
          <Link href="/pricing" className="text-teal-700 dark:text-teal-400 font-medium hover:underline">
            Compare all plans and add-ons &rarr;
          </Link>
        </p>
      </Section>

      {/* Accountant collaboration */}
      <Section className="border-t border-gray-100 dark:border-midnight-900">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-midnight-900 dark:text-white">Built to work with your accountant</h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Invite your accountant into any organization with the right level of access, and let them work the way
              they already do &mdash; journals, reconciliation and month-end close, all inside Lumviq.
            </p>
            <Link href="/accountants" className="mt-4 inline-block text-teal-700 dark:text-teal-400 font-medium hover:underline">
              Explore Accountant Mode &rarr;
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {ACCOUNTANT_COLLABORATION.map((item) => (
              <li key={item} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                <span aria-hidden="true" className="text-teal-600">&#10003;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Integrations */}
      <Section className="border-t border-gray-100 dark:border-midnight-900">
        <h2 className="text-2xl md:text-3xl font-semibold text-midnight-900 dark:text-white text-center">Connects with the tools you already use</h2>
        <div className="mt-10 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {INTEGRATION_CATEGORIES.map((c) => (
            <div key={c.category} className="rounded-lg border border-gray-200 dark:border-midnight-800 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-midnight-800 dark:text-white">{c.category}</h3>
                <span className="text-[10px] uppercase tracking-wide text-gold-700 dark:text-gold-400 bg-gold-50 dark:bg-midnight-800 rounded-full px-2 py-0.5">
                  Coming soon
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{c.examples.join(', ')}</p>
            </div>
          ))}
        </div>
        <p className="text-center mt-6">
          <Link href="/integrations" className="text-teal-700 dark:text-teal-400 font-medium hover:underline">
            See all integration categories &rarr;
          </Link>
        </p>
      </Section>

      {/* Security */}
      <Section className="border-t border-gray-100 dark:border-midnight-900">
        <h2 className="text-2xl md:text-3xl font-semibold text-midnight-900 dark:text-white text-center">Security you can verify</h2>
        <ul className="mt-10 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {SECURITY_HIGHLIGHTS.map((s) => (
            <li key={s} className="rounded-lg border border-gray-200 dark:border-midnight-800 p-4 text-sm text-gray-700 dark:text-gray-300">
              {s}
            </li>
          ))}
        </ul>
        <p className="text-center mt-6">
          <Link href="/security" className="text-teal-700 dark:text-teal-400 font-medium hover:underline">
            Read the full security overview &rarr;
          </Link>
        </p>
      </Section>

      {/* FAQ */}
      <Section className="border-t border-gray-100 dark:border-midnight-900 max-w-3xl">
        <h2 className="text-2xl md:text-3xl font-semibold text-midnight-900 dark:text-white text-center mb-6">
          Frequently asked questions
        </h2>
        <FAQAccordion items={FAQ_ITEMS} />
      </Section>

      {/* Final CTA */}
      <Section className="border-t border-gray-100 dark:border-midnight-900 text-center py-20">
        <h2 className="text-3xl font-semibold text-midnight-900 dark:text-white">Your financial picture starts here.</h2>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/signup" className="rounded-md bg-teal-600 text-white px-6 py-3 font-medium hover:bg-teal-700">
            Start Free
          </Link>
          <Link href="/compare" className="rounded-md border border-gray-300 dark:border-midnight-700 px-6 py-3 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800">
            Compare Plans
          </Link>
        </div>
      </Section>
    </MarketingLayout>
  )
}
