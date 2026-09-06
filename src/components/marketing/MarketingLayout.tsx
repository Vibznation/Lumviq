import React from 'react'
import Head from 'next/head'
import AnnouncementBar from './AnnouncementBar'
import MarketingHeader from './MarketingHeader'
import MarketingFooter from './MarketingFooter'
import { brand } from '../../lib/brand'

export interface MarketingLayoutProps {
  title: string
  description: string
  path: string
  jsonLd?: Record<string, unknown>
  children: React.ReactNode
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lumviq.com'

/**
 * Shared shell for every public marketing page: announcement bar, sticky
 * header, footer, and per-page SEO metadata (unique title/description,
 * canonical URL, Open Graph tags, and optional JSON-LD structured data).
 */
export default function MarketingLayout({ title, description, path, jsonLd, children }: MarketingLayoutProps) {
  const canonical = `${SITE_URL}${path}`
  const fullTitle = `${title} | ${brand.name}`

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-midnight-950">
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={fullTitle} />
        <meta name="twitter:description" content={description} />
        {jsonLd && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        )}
      </Head>
      <AnnouncementBar />
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}
