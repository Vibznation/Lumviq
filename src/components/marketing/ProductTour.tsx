import React, { useState } from 'react'

interface TourTab {
  key: string
  label: string
  render: () => React.ReactNode
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-midnight-800 p-4 bg-white dark:bg-midnight-900">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={'text-xl font-semibold mt-1 ' + (accent || 'text-midnight-900 dark:text-white')}>{value}</p>
    </div>
  )
}

function Bars({ heights }: { heights: number[] }) {
  return (
    <div className="flex items-end gap-2 h-24">
      {heights.map((h, i) => (
        <div key={i} className="flex-1 rounded-t bg-teal-500/70 dark:bg-teal-400/70" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}

const TABS: TourTab[] = [
  {
    key: 'overview',
    label: 'Overview',
    render: () => (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Cash position" value="$48,210" />
        <StatCard label="Revenue (MTD)" value="$21,340" accent="text-teal-600 dark:text-teal-400" />
        <StatCard label="Expenses (MTD)" value="$9,875" />
        <StatCard label="Outstanding invoices" value="$6,420" accent="text-gold-600 dark:text-gold-400" />
        <div className="col-span-2 md:col-span-4 rounded-lg border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-midnight-800 p-4 text-sm text-teal-800 dark:text-teal-300">
          Lumviq Intelligence: cash reserves cover roughly 4.5 months at your current burn rate. You review, you decide.
        </div>
      </div>
    ),
  },
  {
    key: 'invoicing',
    label: 'Invoicing',
    render: () => (
      <div className="space-y-2">
        {[
          { name: 'Northwind Studio', amount: '$2,400', status: 'Paid' },
          { name: 'Harbor & Co.', amount: '$1,150', status: 'Sent' },
          { name: 'Blue Cedar LLC', amount: '$3,980', status: 'Overdue' },
        ].map((row) => (
          <div key={row.name} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-midnight-800 px-4 py-3 text-sm">
            <span className="text-gray-700 dark:text-gray-300">{row.name}</span>
            <span className="font-medium text-midnight-900 dark:text-white">{row.amount}</span>
            <span
              className={
                'text-xs font-medium rounded-full px-2 py-1 ' +
                (row.status === 'Paid'
                  ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300'
                  : row.status === 'Overdue'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-midnight-800 dark:text-gray-300')
              }
            >
              {row.status}
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: 'expenses',
    label: 'Expenses',
    render: () => (
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Software" value="$1,240" />
        <StatCard label="Contractors" value="$3,600" />
        <StatCard label="Office supplies" value="$310" />
        <StatCard label="Travel" value="$860" />
      </div>
    ),
  },
  {
    key: 'banking',
    label: 'Banking',
    render: () => (
      <div className="rounded-lg border border-gray-200 dark:border-midnight-800 p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Reconciliation status</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-midnight-800 overflow-hidden">
            <div className="h-full bg-teal-500" style={{ width: '92%' }} />
          </div>
          <span className="text-sm font-medium text-midnight-900 dark:text-white">92% matched</span>
        </div>
      </div>
    ),
  },
  {
    key: 'reporting',
    label: 'Reporting',
    render: () => <Bars heights={[40, 65, 50, 80, 60, 90, 70]} />,
  },
  {
    key: 'intelligence',
    label: 'Lumviq Intelligence',
    render: () => (
      <div className="rounded-lg border border-gray-200 dark:border-midnight-800 p-4 text-sm text-gray-700 dark:text-gray-300 space-y-2">
        <p><strong>Suggestion:</strong> 6 uncategorized transactions look like recurring software subscriptions.</p>
        <p><strong>Anomaly:</strong> a $2,300 expense is 3.1x your category average this month.</p>
        <p className="text-xs text-gray-400">Lumviq recommends. You review and approve.</p>
      </div>
    ),
  },
]

/**
 * Original, accessible tabbed product preview. No automatic motion — the
 * active tab only changes on user interaction (click or arrow keys).
 */
export default function ProductTour() {
  const [active, setActive] = useState(0)

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') setActive((i) => (i + 1) % TABS.length)
    if (e.key === 'ArrowLeft') setActive((i) => (i - 1 + TABS.length) % TABS.length)
  }

  return (
    <div>
      <div role="tablist" aria-label="Lumviq product tour" className="flex flex-wrap gap-2 mb-4" onKeyDown={onKeyDown}>
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            role="tab"
            id={`tour-tab-${tab.key}`}
            aria-selected={active === i}
            aria-controls={`tour-panel-${tab.key}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            className={
              'rounded-full px-4 py-1.5 text-sm font-medium ' +
              (active === i
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 dark:bg-midnight-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-midnight-700')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      {TABS.map((tab, i) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`tour-panel-${tab.key}`}
          aria-labelledby={`tour-tab-${tab.key}`}
          hidden={active !== i}
        >
          {active === i && tab.render()}
        </div>
      ))}
    </div>
  )
}
