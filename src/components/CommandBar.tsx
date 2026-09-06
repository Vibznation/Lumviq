import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { authHeaders, useAuth } from '../lib/auth-context'
import type { SearchResult } from '../pages/api/search'
import { brand } from '../lib/brand'

/**
 * Functional global command bar: searches customers, vendors, invoices,
 * bills and accounts (see src/pages/api/search.ts) and navigates to the
 * matching record. Does not yet support natural-language "ask Lumviq"
 * questions or in-place record creation — see docs/known-limitations.md.
 */
export default function CommandBar() {
  const { token, currentOrg } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!currentOrg || query.trim().length < 2) {
      setResults([])
      return
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?organizationId=${currentOrg.id}&q=${encodeURIComponent(query)}`,
          { headers: authHeaders(token) }
        )
        if (!res.ok) return
        const json = await res.json()
        setResults(json.results || [])
        setOpen(true)
      } catch {
        // Search is best-effort; ignore transient failures.
      }
    }, 200)
    return () => clearTimeout(handle)
  }, [query, currentOrg, token])

  function selectResult(result: SearchResult) {
    setOpen(false)
    setQuery('')
    router.push(result.href)
  }

  return (
    <div className="relative flex-1 max-w-xl" ref={containerRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={`Search ${brand.name}: customers, vendors, invoices, bills, accounts…`}
        className="w-full text-sm rounded-md border border-gray-300 dark:border-midnight-700 bg-gray-50 dark:bg-midnight-800 dark:text-gray-100 px-3 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500"
        aria-label="Global command bar"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-md shadow-lg max-h-80 overflow-auto">
          {results.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <button
                type="button"
                onClick={() => selectResult(r)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-midnight-800 flex items-center justify-between"
              >
                <span className="text-gray-800 dark:text-gray-100">{r.label}</span>
                {r.sublabel && <span className="text-xs text-gray-400">{r.sublabel}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-md shadow-lg px-3 py-2 text-sm text-gray-500">
          No matches for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  )
}
