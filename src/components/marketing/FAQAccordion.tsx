import React, { useState } from 'react'
import { FaqItem } from '../../lib/marketing-content'

export default function FAQAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="divide-y divide-gray-200 dark:divide-midnight-800 border-t border-b border-gray-200 dark:border-midnight-800">
      {items.map((item, i) => {
        const open = openIndex === i
        const panelId = `faq-panel-${i}`
        const buttonId = `faq-button-${i}`
        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : i)}
                className="w-full flex items-center justify-between gap-4 py-4 text-left text-sm font-medium text-midnight-800 dark:text-gray-100"
              >
                <span>{item.question}</span>
                <span aria-hidden="true" className="text-gray-400">{open ? '−' : '+'}</span>
              </button>
            </h3>
            {open && (
              <div id={panelId} role="region" aria-labelledby={buttonId} className="pb-4 text-sm text-gray-600 dark:text-gray-400">
                {item.answer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
