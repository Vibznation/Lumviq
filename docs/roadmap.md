# Roadmap

## Done
- Auth, organizations, roles, invitations
- Chart of accounts, general ledger, fiscal years/periods, audit events
- Banking import + reconciliation
- Sales / invoicing (AR): customers, invoices, tax rates, projects on
  invoice lines, payments, void
- Purchasing / bills (AP): vendors, bills, tax rates, payments, void
- Inventory: products, average-cost stock movements, manual adjustments
- Projects & time tracking: projects, time entries, budget usage
- Budgeting: per-account monthly budgets, budget vs actual report
- Multi-entity: parent/child organization linking, consolidated
  (side-by-side, non-merged) reporting
- Payroll: employees, pay runs, ledger posting for gross pay (accounting
  impact only — see [known limitations](known-limitations.md))
- Reports hub: trial balance, P&L, balance sheet, AR/AP aging, tax
  summary, budget vs actual, inventory valuation
- AI Intelligence: deterministic rule-based insights (cash forecast,
  overdue receivables, unusual transactions, category suggestions)
- Integration interfaces (bank feed / payments / OCR) — stubs only
- Product selectors on invoice/bill line-item rows in the `new.tsx`
  forms, so inventory quantities/COGS post automatically from
  sales/purchases without needing direct API calls.
- Dedicated unit tests for Phase 3 domain logic: money/minor-unit
  arithmetic, average-cost inventory movements, payroll posting matrix,
  and invoice/bill posting including COGS.
- Marketing website and pricing/billing system: centralized plan/add-on
  configuration (`src/lib/plans.ts`) and server-side entitlement gating
  (`src/lib/entitlements.ts`), 5 pricing plans (Free/Start/Grow/Scale/
  Enterprise) with cumulative feature inheritance, add-on catalog
  (Payroll, Payments, Expert, Commerce, Nonprofit Enhanced), a 3-step
  `/checkout` flow, full marketing site (`/`, `/features`, `/pricing`,
  `/compare`, `/solutions` + 7 industry pages, `/accountants`,
  `/integrations`, `/security`, `/resources`, `/contact-sales`),
  `/signin` and `/signup` aliases, an in-app `/settings/billing` page,
  and `SubscriptionEvent`/`ContactSalesSubmission` tables for audit and
  lead capture. See [Lumviq marketing/billing phase](lumviq-marketing-billing.md)
  for full detail on what's live vs. simulated.

## Next up
- Real bank feed provider integration (Plaid or similar) behind the
  existing `BankFeedProvider` interface.
- Real payment processor integration (Stripe or similar) behind the
  existing `PaymentProcessor` interface, for collecting invoice payments
  online.
- Receipt/bill OCR provider behind the existing `OcrProvider` interface.
- Payroll tax withholding/filing and direct deposit via a licensed
  payroll provider integration (e.g., Check, Gusto embedded).
- Multi-currency support.
- FIFO/LIFO inventory costing options (currently average-cost only).
- Scheduled/cached report generation for large datasets.
- Fund accounting specifics for nonprofit organizations.
- Three-way PO matching (purchase order → receipt → bill).
- A real payment processor behind Lumviq Payments and a licensed payroll
  provider behind the Payroll add-ons (both currently priced/configured
  but not connected to a live provider — see honest-disclaimer copy on
  `/pricing`).
- Analytics vendor + cookie-consent banner (the `track()` helper in
  `src/lib/analytics.ts` is wired but inert until a vendor is chosen).

