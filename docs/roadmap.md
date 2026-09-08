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
- **Phase 5 expansion**: Documents (file attachments on bills/invoices),
  in-app Notifications, Approval Center (pending-action gating, wired
  end-to-end for bill payments ≥ $500), Data Import/Export (CSV for
  customers/vendors/accounts with dry-run preview), Nonprofit fund/grant
  tracking, manually-entered multi-currency exchange rates, Dimensions
  (department/location/program tagging on manual journal entries),
  Contractor (1099) directory, outbound Webhooks (signed delivery
  logging), a functional global command bar (record search), AI
  interaction audit logging for Intelligence insights, and security
  hardening (CSP/security headers, in-memory auth rate limiting). See
  [known-limitations.md](known-limitations.md) for the honest scope
  boundary of each of these, and [verification-report.md](verification-report.md)
  for the commands run to verify this phase.
- **Phase 6 expansion**: Sales estimates (with convert-to-invoice) and
  recurring invoice/bill templates; Purchasing purchase orders (with
  convert-to-bill), vendor credits and expense reimbursements (with an
  approve/reject/pay decision flow); Project staff allocation and
  progress invoicing; Inventory multiple locations; three new report
  tabs (Job Costing, Product Profitability, Customer Statements);
  Nonprofit donations (auto-posting deposits) and pledges (with a
  fulfill action); Custom roles with a configurable permission set per
  role; Custom fields per entity type; Workflow automation (on-demand
  rule evaluation for overdue invoices, bills due soon, and low stock);
  configurable per-resource-type Approval thresholds; an Audit history
  viewer; Budget scenarios (\"what-if\" percentage adjustments) and
  Custom KPIs / executive dashboard on the Planning page; an AI Chat tab
  next to Intelligence Insights; and an in-app Support ticket log. See
  [known-limitations.md](known-limitations.md) for what remains
  unfinished within each of these (e.g. no background scheduler for
  Workflow automation, no compute/apply step for Budget scenarios, no
  ticket-status transitions for Support).

- **Phase 7 expansion**: a durable DB-backed background job queue
  (`BackgroundJob` table, `src/lib/jobs.ts`, processed via
  `POST /api/jobs/process` for an external cron to call); real outbound
  email via SMTP (`src/lib/integrations/email.ts`, honest log-only
  fallback, every attempt recorded in `EmailLog`) wired into the
  organization-invite flow; real signed HTTP webhook delivery
  (`src/lib/webhooks.ts`) dispatched asynchronously through the job
  queue instead of only being logged; account reconciliation for any
  balance-sheet account with a line-clearing workflow
  (`src/lib/account-reconciliation.ts`); a period close checklist
  (`src/lib/close-checklist.ts`); a fixed asset register with
  straight-line depreciation posting (`src/lib/fixed-assets.ts`); a
  loan/amortization module with payment posting
  (`src/lib/loans.ts`); three-way PO matching (order vs. receipt vs.
  bill, `src/lib/three-way-match.ts`) and non-blocking duplicate-bill
  detection; multi-line expense reports on Reimbursements
  (`ReimbursementLine`); a Budget scenario compute/apply engine that
  projects and can materialize a new budget from a scenario's
  adjustments (`src/lib/budget-scenarios.ts`); intercompany
  transactions with due-to/due-from posting on both organizations and a
  consolidated trial balance with elimination netting
  (`src/lib/consolidation.ts`); and time-limited guest self-service
  portals for customers (view-only invoice link) and vendors (bill/
  receipt upload link). See [known-limitations.md](known-limitations.md)
  for the honest scope boundary of each (most of these have no
  dedicated UI page yet — API-complete only).
- **Approval gating expansion**: extended the Approval Center beyond
  bill payments to reimbursement payouts, purchase order issuance
  (draft → sent), manual journal entries, and payroll run posting —
  each checked against a per-organization configurable threshold
  (`Organization.approvalThresholds`, falling back to
  `APPROVAL_THRESHOLDS` defaults). Also fixed a missing tenant-membership
  check on `POST /api/ledger/post` (any authenticated user could
  previously post to any organization's ledger by supplying its
  `organizationId`) and refactored `src/lib/ledger.ts` to expose a
  transaction-scoped `postJournalEntryTx` so the approvals executor can
  post an approved journal entry without opening a nested transaction.
- **Entitlement enforcement expansion**: wired `src/lib/entitlements.ts`'s
  `enforceFeature`/`enforceLimit` gates into a representative sample of
  API routes as real 403-returning server-side checks (previously
  entitlements only drove client-side UI locking) — purchase orders,
  budgets, time entries, locations, donations, custom fields, workflows,
  vendor credits (feature gates), plus invoice creation and organization
  invites (numeric plan-limit gates for `invoicesPerMonth`, `users` and
  `accountantInvitations`, the latter counting pending invitations so
  seats can't be reserved past the limit). See
  [known-limitations.md](known-limitations.md) for the full list and
  what remains client-side-only.- **UI pages for account reconciliation, close checklist, fixed assets,
  and loans**: added `/accounting/reconcile-account` (list + detail with
  a line-clearing workflow and completion), `/accounting/close-checklist`
  (per-period checklist creation and item toggling), `/accounting/fixed-assets`
  (register + detail with a "Post depreciation" action), and
  `/accounting/loans` (register + detail with a "Post next payment"
  action), all wired to the existing API routes. Added a new
  `GET /api/accounting-periods` route (accounting periods have no direct
  `organizationId`, only via `FiscalYear`) and `GET` single-record routes
  for `/api/fixed-assets/[id]` and `/api/loans/[id]`, which didn't
  previously exist.
- **UI pages for budget scenario run and intercompany transactions**:
  added a "Preview"/"Apply to budget" flow to the existing Scenarios tab
  on `/planning` (calls `POST /api/budget-scenarios/[id]/run` and shows a
  baseline/projected-by-month table), and a new
  `/settings/intercompany-transactions` page (create form with a linked
  -organization picker sourced from a new `GET /api/orgs/linked` route,
  per-organization account dropdowns, and an "Eliminate" action), cross
  -linked from `/settings/multi-entity` and `/settings/organization`.
  Along the way, fixed a latent shape bug: `computeScenario` in
  `src/lib/budget-scenarios.ts` expected `BudgetScenario.adjustments` to
  always be an array of `{accountId, type, value}`, but the Planning
  page's scenario-creation form had always saved it as a
  `Record<accountId, percent>` object — this had never been caught
  because no UI previously called the run endpoint. Added
  backward-compatible normalization for both shapes plus a first unit
  test file for this module (`tests/budget-scenarios.test.ts`).
- **Custom role org-scoping and support ticket status transitions**:
  `Role` previously had a globally-unique `name` shared across every
  organization, and `GET /api/roles` returned every organization's
  custom roles to any member — added `Role.organizationId` (migration
  `0013_role_org_scope`, backfilled from existing memberships) with a
  composite `[organizationId, name]` unique constraint, and scoped
  `GET`/`POST /api/roles` and `PUT /api/roles/[id]/permissions`
  accordingly. Added `PATCH /api/support-tickets/[id]` for moving a
  ticket between `open`/`in_progress`/`resolved`/`closed`, wired to a
  status dropdown on `/support`.
- **Approver-role restriction and expanded approval gating**: deciding a
  pending `Approval` (`POST /api/approvals/[id]/decide`) previously only
  required organization membership, so any member could approve/reject
  sensitive money-moving actions — now gated behind a new
  `approvals.decide` permission (owners always qualify; other members
  need it granted via a custom role, matching the existing
  `bank.reconcile`/`manage_organization` convention of not seeding a
  default `Permission` row). Also extended amount-threshold approval
  gating to budget changes (`POST /api/budgets`, new `budget-change`
  threshold, default $5,000) and added `PATCH /api/banking/accounts/[id]`
  for editing a bank account's provider/account number, which always
  requires approval when those sensitive fields change. Vendor-side
  banking/ACH details still don't exist as a schema concept, so that
  half of the original "vendor/banking-detail changes" gap remains open.

## Next up
- Real bank feed provider integration (Plaid or similar) behind the
  existing `BankFeedProvider` interface.
- Real payment processor integration (Stripe or similar) behind the
  existing `PaymentProcessor` interface, for collecting invoice payments
  online (this would also enable online payment on the customer invoice
  portal, which is currently view-only).
- Receipt/bill OCR provider behind the existing `OcrProvider` interface.
- Payroll tax withholding/filing and direct deposit via a licensed
  payroll provider integration (e.g., Check, Gusto embedded).
- Scheduled/cached report generation for large datasets.
- Analytics vendor + cookie-consent banner (the `track()` helper in
  `src/lib/analytics.ts` is wired but inert until a vendor is chosen).
- Live exchange-rate provider (currently manual entry only).
- Object storage for Documents (currently local disk — see
  [security-notes.md](security-notes.md)).
- Dedicated unit tests for the Phase 5/6/7 domain modules (approvals,
  documents, notifications, currency, dimensions, contractors,
  nonprofit, import-export, webhooks, estimates, purchase orders,
  vendor credits, reimbursements, recurring templates, roles/
  permissions, custom fields, workflows, KPIs, support tickets, jobs,
  email, account reconciliation, close checklist, fixed assets, loans,
  three-way match, consolidation). `budget-scenarios.ts` now has a
  first test file (`tests/budget-scenarios.test.ts`).
- FIFO/LIFO inventory costing options (currently average-cost only).
- A background scheduler (or documented external cron pattern) to run
  Workflow automation rules and the `/api/jobs/process` queue
  automatically instead of only on-demand.
- Bill-line-to-PO-line matching by a real foreign key instead of
  description-text matching, for accurate three-way match results.
- Multi-level (grandchild) consolidation hierarchies.
- Extending server-side entitlement enforcement (`enforceFeature`/
  `enforceLimit`) beyond the current sample of routes to the remaining
  feature- and limit-gated API routes, which still rely solely on
  client-side UI locking.

