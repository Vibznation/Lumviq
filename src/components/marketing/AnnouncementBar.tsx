import React, { useEffect, useState } from 'react'
import { ANNOUNCEMENT_MESSAGE } from '../../lib/marketing-content'

const DISMISS_KEY = 'lumviq_announcement_dismissed_v1'

/**
 * Configurable promotional message. The message itself lives in
 * src/lib/marketing-content.ts (ANNOUNCEMENT_MESSAGE) so it can be changed
 * without touching this component. Intentionally has no countdown timer or
 * hard-coded discount amount — see project instructions against fake urgency.
 */
export default function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1')
  }, [])

  if (dismissed || !ANNOUNCEMENT_MESSAGE) return null

  return (
    <div className="bg-midnight-900 text-white text-sm">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <p className="text-center flex-1">{ANNOUNCEMENT_MESSAGE}</p>
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, '1')
            setDismissed(true)
          }}
          aria-label="Dismiss announcement"
          className="shrink-0 rounded p-1 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
