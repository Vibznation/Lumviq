import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { brand } from '../../lib/brand'
import { useAuth } from '../../lib/auth-context'
import { PRIMARY_NAV, NavItem } from '../../lib/marketing-content'
import { track } from '../../lib/analytics'

function NavDropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  if (!item.items) {
    return (
      <Link
        href={item.href!}
        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-teal-700 dark:hover:text-teal-400"
      >
        {item.label}
      </Link>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-teal-700 dark:hover:text-teal-400 flex items-center gap-1"
      >
        {item.label}
        <span aria-hidden="true" className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 w-72 rounded-lg border border-gray-200 dark:border-midnight-800 bg-white dark:bg-midnight-900 shadow-lg py-2 z-50"
        >
          {item.items.map((sub) => (
            <Link
              key={sub.href}
              href={sub.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 hover:bg-gray-50 dark:hover:bg-midnight-800"
            >
              <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">{sub.label}</span>
              {sub.description && <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub.description}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MarketingHeader() {
  const { token } = useAuth()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [router.pathname])

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-midnight-950/90 backdrop-blur border-b border-gray-200 dark:border-midnight-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="text-lg font-semibold text-midnight-800 dark:text-white shrink-0">
          {brand.name}
        </Link>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1">
          {PRIMARY_NAV.map((item) => (
            <NavDropdown key={item.label} item={item} />
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3 shrink-0">
          {token ? (
            <Link href="/dashboard" className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:underline">
              Go to dashboard
            </Link>
          ) : (
            <Link href="/signin" className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:underline">
              Sign in
            </Link>
          )}
          <Link
            href="/contact-sales"
            onClick={() => track('cta_click', { cta: 'talk_to_sales', location: 'header' })}
            className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:underline"
          >
            Talk to Sales
          </Link>
          <Link
            href="/signup"
            onClick={() => track('cta_click', { cta: 'start_free', location: 'header' })}
            className="rounded-md bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700"
          >
            Start Free
          </Link>
        </div>

        <button
          type="button"
          className="lg:hidden rounded-md p-2 text-gray-700 dark:text-gray-200"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {mobileOpen && (
        <nav id="mobile-nav" aria-label="Mobile" className="lg:hidden border-t border-gray-200 dark:border-midnight-800 bg-white dark:bg-midnight-950 px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {PRIMARY_NAV.map((item) => (
            <div key={item.label}>
              {item.href && !item.items ? (
                <Link href={item.href} className="block text-sm font-semibold text-gray-800 dark:text-gray-100 py-1">
                  {item.label}
                </Link>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 py-1">{item.label}</p>
                  <div className="pl-3 space-y-1 border-l border-gray-200 dark:border-midnight-800">
                    {item.items!.map((sub) => (
                      <Link key={sub.href} href={sub.href} className="block text-sm text-gray-600 dark:text-gray-300 py-1">
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
          <div className="pt-3 border-t border-gray-200 dark:border-midnight-800 flex flex-col gap-2">
            {token ? (
              <Link href="/dashboard" className="text-sm font-medium text-gray-700 dark:text-gray-200">Go to dashboard</Link>
            ) : (
              <Link href="/signin" className="text-sm font-medium text-gray-700 dark:text-gray-200">Sign in</Link>
            )}
            <Link href="/contact-sales" className="text-sm font-medium text-gray-700 dark:text-gray-200">Talk to Sales</Link>
            <Link href="/signup" className="rounded-md bg-teal-600 text-white px-4 py-2 text-sm font-medium text-center hover:bg-teal-700">
              Start Free
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
