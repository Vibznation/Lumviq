/**
 * Privacy-conscious analytics interface for marketing-site interactions.
 *
 * No analytics vendor is configured yet. `track()` only sends events if
 * NEXT_PUBLIC_ANALYTICS_ENABLED is "true" (set once a vendor + cookie
 * consent flow are in place) and always requires consent to already have
 * been granted. Until then, events are recorded to the console in
 * development only, so instrumentation call sites can be added now without
 * shipping a fake or unapproved tracking vendor.
 */

export type MarketingEvent =
  | 'cta_click'
  | 'pricing_view'
  | 'plan_selected'
  | 'addon_selected'
  | 'signup_started'
  | 'signup_completed'
  | 'contact_sales_submitted'
  | 'comparison_interaction'

const CONSENT_KEY = 'lumviq_analytics_consent'

export function hasAnalyticsConsent(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(CONSENT_KEY) === 'granted'
}

export function setAnalyticsConsent(granted: boolean) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied')
}

export function track(event: MarketingEvent, properties: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  if (!hasAnalyticsConsent()) return

  const enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'
  if (!enabled) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug('[analytics:dev-only]', event, properties)
    }
    return
  }

  // No vendor is wired up yet. When one is added (e.g. a first-party
  // endpoint or an approved analytics provider), send the event here.
}
