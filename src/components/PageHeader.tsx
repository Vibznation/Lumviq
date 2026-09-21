import React from 'react'
import Link from 'next/link'

type Action = {
  label: string
  href: string
  variant?: 'primary' | 'secondary'
}

type QuickLink = {
  label: string
  href: string
  icon?: string
}

export default function PageHeader({
  icon,
  eyebrow,
  title,
  subtitle,
  actions,
  quickLinks,
}: {
  icon?: string
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: Action[]
  quickLinks?: QuickLink[]
}) {
  return (
    <div className="bg-gradient-to-r from-teal-900 via-midnight-900 to-midnight-950 text-white rounded-2xl p-5 md:p-7 shadow-sm border border-teal-800/40 relative overflow-hidden mb-6">
      <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-56 h-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          {eyebrow && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              {eyebrow}
            </div>
          )}
          <h1 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2">
            {icon && <span className="text-lg md:text-xl">{icon}</span>}
            {title}
          </h1>
          {subtitle && <p className="text-sm text-teal-100/80 mt-1 max-w-xl">{subtitle}</p>}
        </div>

        {actions && actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {actions.map((a) =>
              a.variant === 'secondary' ? (
                <Link
                  key={a.href}
                  href={a.href}
                  className="inline-flex items-center justify-center px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 transition-all"
                >
                  {a.label}
                </Link>
              ) : (
                <Link
                  key={a.href}
                  href={a.href}
                  className="inline-flex items-center justify-center px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-midnight-950 font-semibold text-sm shadow transition-all"
                >
                  {a.label}
                </Link>
              )
            )}
          </div>
        )}
      </div>

      {quickLinks && quickLinks.length > 0 && (
        <div
          className="mt-5 pt-5 border-t border-white/10 grid gap-2.5 text-xs"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))` }}
        >
          {quickLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-teal-100 font-medium"
            >
              {l.icon && <span>{l.icon}</span>}
              <span>{l.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
