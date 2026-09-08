# Known limitations

Lumviq is transparent about what it does and does not do. This document lists
explicit scope boundaries so no feature is misrepresented.

## Payroll
- Lumviq records the **accounting impact** of a pay run only. It does not
  calculate tax withholding, file payroll tax returns, or perform direct
  deposit — those must come from a licensed payroll provider (e.g. Gusto,
  ADP, QuickBooks Payroll).
- Workflow: create a pay run with each employee's gross pay, run payroll
  with your provider, then use **Enter provider totals** on the Payroll
  page to record each employee's tax withholding and the employer's
  payroll tax expense from the provider's report — before posting to the
  ledger.
- Posting then records: Debit Payroll Expense (gross) and Payroll Tax
  Expense (employer taxes, if any); Credit Payroll Liabilities (net pay
  owed to employees) and Payroll Taxes Payable (withholding + employer
  taxes owed to agencies, if any). Remitting those liabilities (paying
  employees/tax agencies) is recorded like any other bill payment — no
  automatic direct deposit or tax filing is performed.

## Tax
- The Tax Summary report is informational — it shows tax collected on
  invoices vs. tax paid on bills, grouped by tax rate. Lumviq does **not**
  file tax returns on the organization's behalf.

## Integrations (bank feeds, payments, OCR)
- `src/lib/integrations/{bank-feed,payments,ocr}.ts` define TypeScript
  interfaces only. No provider is wired up.
- The Settings → Integrations page always shows these as "Not connected".
  Bank activity must be imported manually (CSV/OFX) on the Banking page;
  invoice/bill payments must be recorded manually; receipts/bills must be
  entered manually (no OCR).

## Multi-entity
- Linking a child organization under a parent is for **side-by-side**
  consolidated reporting only. Journal entries and ledgers are never
  merged across organizations — each entity remains fully independent
  for accounting and audit purposes.

## AI Intelligence
- The Intelligence page uses deterministic, rule-based calculations
  (linear cash-flow projection, z-score outlier detection on journal
  entries, direct queries for overdue invoices, frequency counts for
  category suggestions) computed from the organization's own data.
- It is **not** a language model and does not call any external AI
  provider. It cannot post journal entries, move money, run payroll,
  file taxes, or close accounting periods — it only reports, and every
  insight shows the data and method (`basis`) used to compute it.

## Inventory
- Valuation uses the average-cost method only (no FIFO/LIFO).
- Negative on-hand quantities are allowed (surfaced as data, not blocked)
  rather than hard-enforced, consistent with an anomaly-detection
  approach rather than rigid stock control.

## Reporting
- Reports (trial balance, P&L, balance sheet, aging, budget vs actual,
  tax summary, inventory valuation) are all computed live from posted
  ledger data. There is no scheduled/cached reporting layer yet, so very
  large datasets may be slower to compute.

## Testing
- Existing unit tests (`npx vitest run`) cover the original ledger,
  posting and reconciliation utilities. Phase 3 domain logic (purchasing,
  inventory, payroll, budgeting, tax, reports) is verified via
  `tsc --noEmit` and a full `next build`, but does not yet have dedicated
  unit tests — this is a gap to close before further changes to that
  code.

## Approvals (pending-action gating)
- Bill payments, reimbursement payouts, purchase order issuance (draft →
  sent), manual journal entries, payroll run posting, and budget changes
  (`POST /api/budgets`) are gated behind approval when their amount is at
  or above a configurable threshold (`APPROVAL_THRESHOLDS` defaults in
  `src/lib/approvals.ts`, overridable per organization via Settings →
  approval thresholds / `Organization.approvalThresholds`). Payroll runs
  default to a $0 threshold (every run requires sign-off) since payroll
  moves real money to employees without a preview step elsewhere in the
  app. Editing an existing bank account's provider/account number
  (`PATCH /api/banking/accounts/[id]`) is also always gated (not
  amount-based — any change to those fields requires approval). Vendor
  banking/ACH details still don't exist as a schema concept at all (the
  `Vendor` model has no bank-account fields), so "vendor banking-detail
  changes" specifically remains unimplemented.
- Deciding (approve/reject) a pending approval requires the
  `approvals.decide` permission rather than plain membership — see
  [permissions-matrix.md](permissions-matrix.md). Like other named
  permissions in this codebase, it has no seeded `Permission` row by
  default, so only the `owner` role can decide approvals until an
  organization creates a custom role granting it.

## Documents
- Files are stored on local disk under `uploads/<organizationId>/` (see
  `src/lib/documents.ts`), not object storage. This will not work
  correctly on ephemeral or multi-instance deployments — see
  [deployment.md](deployment.md).
- 10MB upload limit; base64-JSON transport (not multipart), so uploads
  are somewhat less efficient than a true multipart form.
- No malware/virus scanning, no OCR/data extraction from attached files.

## Notifications
- In-app only — no email or push delivery.

## Import / Export
- CSV import/export is supported for customers, vendors and chart of
  accounts only (`src/lib/import-export.ts`). Invoices, bills, bank
  transactions and opening-balance imports are **not** supported by this
  generic importer (bank CSV/OFX import has its own separate flow at
  `/banking/import`).
- "Dry-run" only previews validation errors; there is no partial-commit
  rollback for a completed import — once committed, invalid rows are
  simply skipped and reported, valid rows are kept.

## Multi-currency
- Exchange rates are entered manually (`src/lib/currency.ts`,
  `/settings/currencies`) — there is no live-rate provider integration.
- Posted ledger amounts remain in their original recorded currency;
  entering a new exchange rate never retroactively changes historical
  journal entries. Conversion is display/reporting-only.

## Dimensions (department/location/program tagging)
- Only manual journal entry lines can be tagged with a `DimensionValue`
  (`journal_lines.dimension_value_id`). Invoice lines, bill lines and
  payroll postings are **not** yet taggable.
- There is no dimension-filtered report yet (e.g. P&L by department).

## Contractors (1099)
- This is a directory for tracking who should receive a 1099 at year
  end, with a year-to-date spend calculator
  (`contractorYearTotal` in `src/lib/contractors.ts`). Lumviq does
  **not** generate, e-file, or print 1099 forms.

## Nonprofit funds & grants
- Funds and grants are tracked for informational reporting
  (`src/lib/nonprofit.ts`); creating a journal entry does not currently
  require selecting a fund, so fund balances are not automatically kept
  in sync with the general ledger. There is no statement-of-activities-
  by-fund report yet.
- Donations post a real ledger deposit (debit the chosen bank account,
  credit an income account) when recorded; pledges do **not** post
  anything until fulfilled (`POST /api/pledges/[id]/fulfill`), at which
  point the fulfilled amount posts the same way a donation does. A
  pledge's `fundId` is informational only — it is not enforced against
  a restricted-fund balance.

## Custom roles
- `Role` rows are scoped per organization (`Role.organizationId` +
  `@@unique([organizationId, name])`, see migration
  `0013_role_org_scope`) — role names only need to be unique within
  their own organization, and members of one organization can no longer
  see or edit another organization's custom roles.

## Workflow automation
- There is **no background scheduler**. Workflow rules (`WorkflowRule`)
  only evaluate and fire when a user clicks "Run due rules" on
  `/settings/workflows`, which calls `POST /api/workflows/run-due`
  (`src/lib/workflows.ts`). Nothing runs on a timer or cron — an
  external scheduler would need to call that endpoint periodically for
  fully automatic behavior.
- Supported triggers are limited to `invoice_overdue`, `bill_due_soon`
  and `low_stock`; actions are limited to creating a `Notification` or a
  pending `Approval`.

## Budget scenarios
- A `BudgetScenario` stores a name and a JSON list of per-account
  adjustments (percent or fixed-amount). `POST /api/budget-scenarios/[id]/run`
  computes a projected month-by-month budget for a target year (baseline
  is either the prior year's actuals or the existing `Budget` table,
  depending on `basedOnActual`) and can materialize it into the `Budget`
  table (`src/lib/budget-scenarios.ts`). The Planning page's Scenarios
  tab now has "Preview"/"Apply to budget" buttons wired to this endpoint,
  showing a baseline/projected-by-month table. The scenario-creation
  form only supports percent-type adjustments (not fixed-amount); use
  the API directly to create a fixed-amount adjustment.

## Support tickets
- `/support` and `POST /api/support-tickets` are an **in-app ticket
  log** only — there is no live chat, no external help-desk/ticketing
  system integration. `PATCH /api/support-tickets/[id]` lets any
  organization member move a ticket between `open`, `in_progress`,
  `resolved` and `closed` (no restriction on transition order — a
  closed ticket can be reopened). The displayed response-time
  expectation is derived from the organization's plan
  (`src/lib/support.ts`) and is informational only.

## AI chat
- `POST /api/intelligence/chat` (surfaced as the Chat tab on
  `/intelligence`) is, like the Insights tab, a small deterministic
  keyword router over the organization's own ledger/invoice/bill data —
  **not** a call to any language model or external AI provider. It only
  answers a fixed set of recognized questions (cash balance, overdue
  invoices, upcoming bills, recent profit) and states the calculation
  method (`basis`) behind every answer.

## Webhooks
- Outbound webhook subscriptions are created and signed (HMAC-SHA256,
  `X-Lumviq-Signature` header) via `src/lib/webhooks.ts`. Deliveries are
  now real HTTP POST requests, but they are **not sent synchronously** —
  `dispatchWebhookEvent` enqueues a `webhook.delivery` background job
  (`BackgroundJob` table), which is only processed when something calls
  `POST /api/jobs/process` (see "Background jobs" below). Existing
  `dispatchWebhookEvent` call sites are unchanged; no new real-event
  emission points were added in this pass. See
  [integration-adapters.md](integration-adapters.md).

## Background jobs
- `src/lib/jobs.ts` implements a durable, DB-backed job queue
  (`BackgroundJob` table) with exponential backoff (1, 5, 15, 60, 240
  minutes across up to 5 attempts). **There is no in-process
  scheduler/timer** — jobs are only processed when something calls
  `POST /api/jobs/process` (auth: `JOBS_PROCESS_SECRET` bearer token or
  a logged-in user). In production this endpoint must be invoked
  periodically by an external scheduler (e.g. a Vercel Cron Job or any
  cron-capable process) or queued jobs (webhook deliveries, invite
  emails) will simply accumulate unprocessed.

## Email delivery
- `src/lib/integrations/email.ts` sends real email via SMTP
  (`nodemailer`) only when `SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM` are set in
  the environment; otherwise messages are logged only (never faked as
  "sent"). Every attempt — success, failure, or log-only — is recorded
  in the new `EmailLog` table. Currently only the organization-invite
  flow (`POST /api/orgs/invite`) enqueues an email job; invoice-sent,
  payment-reminder and approval-notification flows do **not** yet send
  email.

## Account reconciliation
- `src/lib/account-reconciliation.ts` and
  `/api/account-reconciliations/*` (with a UI at `/accounting/reconcile-account`)
  support reconciling **any** balance-sheet account (not just bank
  accounts) against a statement balance, with a line-clearing workflow.
  Completion is blocked unless the cleared-line total matches the
  entered statement balance within $0.01.

## Period close checklist
- `src/lib/close-checklist.ts` and `/api/close-checklist/*` (with a UI
  at `/accounting/close-checklist`) let an organization create a
  checklist of close tasks for an `AccountingPeriod` (8 default tasks,
  or custom labels) and track each item's status/assignment/notes.
  Completing checklist items does **not** automatically close the
  period — closing a period is still a separate, existing action.

## Fixed assets & depreciation
- `src/lib/fixed-assets.ts` and `/api/fixed-assets/*` (with a UI at
  `/accounting/fixed-assets`) support a fixed asset register with
  **straight-line depreciation only** (no declining-balance,
  units-of-production, or bonus/Section 179 depreciation). Posting one
  month of depreciation (`POST /api/fixed-assets/[id]/depreciate`) is
  idempotent per asset/period and stops automatically once accumulated
  depreciation reaches cost minus salvage value. There is no automatic
  monthly scheduling — depreciation must be posted manually (or via an
  external scheduler calling the API) for each period.

## Loans
- `src/lib/loans.ts` and `/api/loans/*` (with a UI at
  `/accounting/loans`) generate a standard amortization schedule and
  post loan payments (principal + interest split) via
  `POST /api/loans/[id]/pay`, which always posts the **next** unpaid
  scheduled payment. There is no support for extra/prepayments,
  variable-rate loans, or refinancing.

## Three-way matching & duplicate bill detection
- `src/lib/three-way-match.ts` and `/api/purchase-order-receipts/*`
  record goods receipts against a purchase order and compare
  ordered vs. received vs. billed quantities
  (`GET /api/purchase-order-receipts/match`). Bill-line-to-PO-line
  matching is done by **description text match only** (Bill has no
  direct FK to a PurchaseOrderLine), so renamed/reworded lines won't
  match correctly. This is a non-blocking check — it does not prevent
  bill creation or payment.
- `POST /api/bills` now also returns a non-blocking `potentialDuplicates`
  list (same vendor + same total within a 7-day window, or a matching
  vendor reference) — informational only, never blocks bill creation.

## Multi-line expense reports
- `Reimbursement` can now have multiple `ReimbursementLine` rows
  (`POST /api/reimbursements/[id]/lines`), each with its own expense
  account; the reimbursement's total `amount` is kept as the sum of its
  lines. Payment posting (`src/lib/reimbursements.ts`) splits the debit
  side per line when lines exist, falling back to the legacy
  single-account behavior otherwise. There is no UI for adding lines
  yet — use the API directly.

## Intercompany transactions & consolidation
- `src/lib/consolidation.ts` and `/api/intercompany-transactions/*`
  (with a UI at `/settings/intercompany-transactions`) post a real
  due-from/due-to journal entry on each side of a parent/child
  organization pair (see `Organization.parentOrganizationId`). Posting
  requires the caller to supply the "offset" account on each side (e.g.
  cash or an expense/revenue account) — these offset accounts are **not
  persisted** on the `IntercompanyTransaction` record, only the
  due-to/due-from accounts are. Only direct parent/child pairs are valid
  counterparties — two sibling organizations under the same parent
  cannot record a transaction directly with each other.
- `GET /api/reports/consolidated` computes a consolidated trial balance
  for a parent and its **direct children only** — multi-level
  (grandchild) hierarchies are not supported. Marking a transaction
  eliminated (`PATCH .../[id]` with `{ action: 'eliminate' }`) nets its
  due-from/due-to balances out of the consolidated totals.

## Customer & vendor self-service portals
- `POST /api/invoices/[id]/portal-token` mints a time-limited guest link
  (`/portal/invoices/[token]`) for view-only invoice access — **no
  online payment** is available (no payment processor is configured;
  see "Integrations" above), so the portal only displays invoice details
  and directs the customer to contact the business directly.
- `POST /api/vendors/[id]/upload-token` mints a time-limited guest link
  (`/portal/vendor-uploads/[token]`) letting a vendor upload a bill/
  receipt file without a Lumviq account; uploads are stored as a
  `Document` (same local-disk storage caveats as the Documents section
  above) and are **not** automatically turned into a draft `Bill` — a
  staff member must still create the bill manually from the uploaded
  file.

## Global command bar
- Supports structured search across customers, vendors, invoices, bills
  and chart-of-accounts (`src/pages/api/search.ts`). Does **not** support
  natural-language "ask a question" queries or in-place record creation
  ("quick create") from the command bar yet.

## MFA / passkeys
- `User.mfaEnabled` / `User.passkeyRegistered` columns exist in the
  schema but there is no enrollment or verification flow implemented —
  these are placeholders for a future feature, not a working control.
  See [security-notes.md](security-notes.md).

## AI interaction logging
- Every call to `/api/intelligence/insights` now writes an
  `AiInteraction` audit row recording what was computed
  (`src/pages/api/intelligence/insights.ts`). This is a log of a
  deterministic calculation for traceability — not a record of any
  external model call, since Lumviq Intelligence does not call an LLM.

## Security / rate limiting
- Login and registration are rate-limited in-memory (per process) — see
  [security-notes.md](security-notes.md) for why this does not scale
  correctly across multiple server instances without a shared store.
- No database-level row-level security; tenant isolation is enforced
  entirely at the application layer.

## Entitlements (plan/feature/limit enforcement)
- `src/lib/entitlements.ts` (`enforceFeature`, `enforceLimit`) is now
  wired into a **representative sample** of API routes as real
  server-side gates, returning `403 { error, upgradeMessage }` when an
  organization's plan doesn't include a feature or has reached a
  numeric limit: `POST /api/purchase-orders` (`expenses.purchase-orders`),
  `POST /api/budgets` (`planning.budgets`), `POST /api/time-entries`
  (`projects.time-tracking`), `POST /api/locations`
  (`inventory.multiple-locations`), `POST /api/donations`
  (`nonprofit.donations`), `POST /api/custom-fields`
  (`team.custom-fields`), `POST /api/workflows`
  (`team.workflow-automation`), `POST /api/vendor-credits`
  (`expenses.vendor-credits`), `POST /api/invoices` (`invoicesPerMonth`,
  counted per calendar month), and `POST /api/orgs/invite`
  (`users`/`accountantInvitations`, counted as active memberships plus
  already-pending, unaccepted invitations of the same kind, so seats
  can't be reserved past the limit by sending invites that are never
  accepted).
- This is intentionally **not exhaustive** — most other feature-gated
  and limit-gated routes still rely solely on the client-side hiding in
  `AppShell`/`dashboard.tsx` (`hasFeature`/`hasAddOn`), which is a UX
  convenience, not a security boundary, and can be bypassed by any
  authenticated member calling the API directly. Extending server-side
  enforcement to the remaining routes is tracked in
  [roadmap.md](roadmap.md).

