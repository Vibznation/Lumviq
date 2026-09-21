import React from 'react'

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={
        'bg-white dark:bg-midnight-900 border border-gray-200 dark:border-midnight-800 rounded-xl shadow-sm ' +
        className
      }
    >
      {children}
    </div>
  )
}

export function EmptyState({
  icon = '📄',
  title,
  description,
  action,
}: {
  icon?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-midnight-900 border border-dashed border-gray-300 dark:border-midnight-700 rounded-xl p-10 text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-sm font-semibold text-midnight-900 dark:text-white">{title}</h3>
      {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-24 bg-gray-100 dark:bg-midnight-900 rounded-xl animate-pulse border border-gray-200 dark:border-midnight-800"
        />
      ))}
    </div>
  )
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'info'
  children: React.ReactNode
}) {
  const toneClasses: Record<string, string> = {
    neutral: 'bg-gray-100 text-gray-700 dark:bg-midnight-800 dark:text-gray-300',
    positive: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
    negative: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    info: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  }
  return (
    <span className={'inline-block rounded-full px-2 py-0.5 text-xs font-medium ' + toneClasses[tone]}>
      {children}
    </span>
  )
}
