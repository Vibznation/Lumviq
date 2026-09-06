# Lumviq marketing website and pricing/billing phase

This documents what shipped in the marketing-site + pricing/entitlements
build-out, and — per the original spec's requirement — states plainly what
is functional, simulated, incomplete, or waiting on credentials/providers.

## Functional (real, working, tested)

- **Centralized plan/add-on configuration** — `src/lib/plans.ts` is the
  single source of truth for plan names, prices, limits, feature catalog
  and add-ons. No UI hard-codes a price or feature list.
- **Server-side entitlements** — `src/lib/entitlements.ts` resolves a real
  organization's `planId`/`addOns` into a feature-key set and exposes
  `requireFeature`/`requireWithinLimit` guards for API routes to call.
  (Not yet wired into every existing feature API route — see Incomplete.)
- **Database-backed billing state** — `Organization.planId`/`billingCycle`/
  `addOns`, `SubscriptionEvent` (audit trail of every plan change) and
  `ContactSalesSubmission` are real Prisma models/tables, migrated via
  `prisma/migrations/0008_billing_and_marketing`.
- **Org creation honors plan selection** — `POST /api/orgs/create` accepts
  `planId`/`billingCycle`/`addOns`, validates them against `plans.ts`, and
  records a `SubscriptionEvent`.
- **In-app plan changes** — `GET/POST /api/billing/plan` (owner-only for
  changes) and `src/pages/settings/billing.tsx`.
- **Contact-sales capture** — `src/lib/contact-sales.ts` (pure, unit-tested
  validation incl. honeypot spam check) + `POST /api/contact-sales`
  (persists to `ContactSalesSubmission`) + `/contact-sales` form UI.
- **Full marketing site**: `/`, `/features`, `/pricing`, `/compare`,
  `/solutions` (+ 7 statically generated industry pages), `/accountants`,
  `/integrations`, `/security`, `/resources`, `/checkout` (3-step,
  query-param-persisted plan/add-on selection), `/signin` and `/signup`
  (thin redirects to the existing `/login`/`/register`, preserving query
  params so a plan selected at checkout survives into `/onboarding`).
- **Unit tests**: `tests/plans.test.ts` (pricing math, annual savings,
  cumulative feature inheritance, order-summary honesty),
  `tests/entitlements.test.ts` (feature/limit gating, upgrade messaging),
  `tests/contact-sales.test.ts` (validation edge cases). All 73 project
  tests pass; `tsc --noEmit` and `next build` (47 pages) both succeed.

## Simulated / not connected to a real provider

- **Payments** — Lumviq Payments add-on is priced/configured but there is
  no payment processor wired up. The pricing page and checkout flow both
  say so explicitly (`PAYMENTS_ADDON_STATUS` in `plans.ts`) and no real
  payment info is ever collected in `/checkout`.
- **Payroll** — Payroll add-ons record the *accounting impact* of a pay run
  only; there is no tax withholding, filing or direct deposit
  (`PAYROLL_ADDON_STATUS` in `plans.ts`, consistent with the pre-existing
  payroll module's known limitations).
- **Integrations** — `/integrations` and the homepage integrations section
  list categories only, each explicitly labeled "Coming soon" — no vendor
  logos or claims of a live connection.
- **Analytics** — `src/lib/analytics.ts` is wired into CTA clicks/checkout
  steps but is a no-op until `NEXT_PUBLIC_ANALYTICS_ENABLED` and a real
  vendor are configured, and it always requires consent first.

## Incomplete / explicitly deferred

- Existing feature API routes (invoices, bills, payroll, inventory, etc.)
  do **not** yet call `requireFeature`/`requireWithinLimit` from
  `entitlements.ts` — the plumbing exists but per-route enforcement is a
  follow-up pass so it can be done deliberately per endpoint.
- `/resources` has placeholder "Coming soon" guides and inline
  privacy/terms/accessibility/cookie/status copy rather than dedicated,
  legally-reviewed policy pages.
- No public system-status page.
- Cookie-consent banner UI (the `hasAnalyticsConsent`/`setAnalyticsConsent`
  functions exist in `analytics.ts`, but nothing currently calls
  `setAnalyticsConsent(true)` from the UI).

## Waiting on credentials/decisions

- A payment processor account (for Lumviq Payments) and a licensed payroll
  provider (for the Payroll add-ons) need to be selected and configured
  before those add-ons can do anything beyond ledger bookkeeping.
- An analytics vendor needs to be chosen before `track()` sends real events.
