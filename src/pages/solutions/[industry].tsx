import React from 'react'
import Link from 'next/link'
import { GetStaticPaths, GetStaticProps } from 'next'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import { brand } from '../../lib/brand'
import { INDUSTRIES, Industry } from '../../lib/marketing-content'
import { getPlan } from '../../lib/plans'

interface Props {
  industry: Industry
}

export default function IndustryPage({ industry }: Props) {
  const plan = getPlan(industry.recommendedPlan)

  return (
    <MarketingLayout
      title={`Lumviq for ${industry.name}`}
      description={`${industry.summary} See how ${brand.name} adapts for ${industry.name.toLowerCase()}.`}
      path={`/solutions/${industry.slug}`}
    >
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
        <p className="text-sm font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide">Solutions</p>
        <h1 className="mt-2 text-3xl md:text-5xl font-semibold text-midnight-900 dark:text-white">
          {brand.name} for {industry.name}
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">{industry.summary}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href={`/checkout?plan=${plan.id}`} className="rounded-md bg-teal-600 text-white px-6 py-3 font-medium hover:bg-teal-700">
            Start with {plan.name}
          </Link>
          <Link href="/pricing" className="rounded-md border border-gray-300 dark:border-midnight-700 px-6 py-3 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-midnight-800">
            See all plans
          </Link>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-20">
        <h2 className="text-xl font-semibold text-midnight-900 dark:text-white">How Lumviq adapts for {industry.name.toLowerCase()}</h2>
        <ul className="mt-6 space-y-3">
          {industry.adaptations.map((a) => (
            <li key={a} className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
              <span aria-hidden="true" className="text-teal-600">&#10003;</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
        <div className="mt-10 rounded-xl border border-gray-200 dark:border-midnight-800 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Recommended plan</p>
          <p className="mt-1 text-lg font-semibold text-midnight-900 dark:text-white">{plan.name}</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{plan.designedFor.join(' \u00b7 ')}</p>
          <Link href={`/checkout?plan=${plan.id}`} className="mt-4 inline-block text-teal-700 dark:text-teal-400 font-medium hover:underline">
            Get started with {plan.name} &rarr;
          </Link>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-20 text-center">
        <Link href="/solutions" className="text-teal-700 dark:text-teal-400 font-medium hover:underline">
          &larr; See all industries
        </Link>
      </section>
    </MarketingLayout>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: INDUSTRIES.map((ind) => ({ params: { industry: ind.slug } })),
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const slug = params?.industry as string
  const industry = INDUSTRIES.find((ind) => ind.slug === slug)
  if (!industry) return { notFound: true }
  return { props: { industry } }
}
