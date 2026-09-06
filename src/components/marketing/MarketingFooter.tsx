import React from 'react'
import Link from 'next/link'
import { brand } from '../../lib/brand'

const FOOTER_COLUMNS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Compare plans', href: '/compare' },
      { label: 'Integrations', href: '/integrations' },
    ],
  },
  {
    heading: 'Solutions',
    links: [
      { label: 'Freelancers', href: '/solutions/freelancers' },
      { label: 'Small Businesses', href: '/solutions/small-business' },
      { label: 'Nonprofits', href: '/solutions/nonprofits' },
      { label: 'Growing Enterprises', href: '/solutions/enterprise' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Accountants', href: '/accountants' },
      { label: 'Security', href: '/security' },
      { label: 'Resources', href: '/resources' },
      { label: 'Contact sales', href: '/contact-sales' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/resources#privacy' },
      { label: 'Terms', href: '/resources#terms' },
      { label: 'Accessibility', href: '/resources#accessibility' },
      { label: 'Cookie Preferences', href: '/resources#cookies' },
      { label: 'System Status', href: '/resources#status' },
    ],
  },
]

export default function MarketingFooter() {
  return (
    <footer className="border-t border-gray-200 dark:border-midnight-800 bg-white dark:bg-midnight-950">
      <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="text-sm font-semibold text-midnight-800 dark:text-white">{col.heading}</h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-gray-600 dark:text-gray-400 hover:text-teal-700 dark:hover:text-teal-400">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 dark:border-midnight-800 px-4 py-6 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} {brand.name}. All figures shown for demo organizations are fictional.
      </div>
    </footer>
  )
}
