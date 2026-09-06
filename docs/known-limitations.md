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
- Only bill payments at or above $500 are gated behind approval today
  (`APPROVAL_THRESHOLDS` in `src/lib/approvals.ts`). Expenses, purchase
  orders, journal entries, payroll runs and vendor/banking-detail changes
  are **not** yet gated — they post/save immediately regardless of
  amount.
- Any organization member can decide (approve/reject) a pending
  approval — there is no "approver" role restriction yet. See
  [permissions-matrix.md](permissions-matrix.md).

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
- `Role.name` is **globally unique** across the entire application, not
  scoped per organization (`src/pages/api/roles/index.ts`) — this is a
  schema-level limitation, not a UI bug. Two organizations cannot both
  have a role named e.g. "Manager"; the settings page hints at
  prefixing role names with the organization name to avoid collisions,
  but does not enforce it.

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
- A `BudgetScenario` stores a name and a JSON map of per-account
  percentage adjustments (`prisma/schema.prisma`), but there is **no
  compute/apply endpoint** — the app does not project a new budget from
  a scenario's adjustments today. The Planning page only lets you
  create and view scenarios; comparing a scenario's projected numbers
  against actuals is not yet implemented.

## Support tickets
- `/support` and `POST /api/support-tickets` are an **in-app ticket
  log** only — there is no live chat, no external help-desk/ticketing
  system integration, and no route to change a ticket's status after
  creation (tickets stay `open` until a future admin action is added).
  The displayed response-time expectation is derived from the
  organization's plan (`src/lib/support.ts`) and is informational only.

## AI chat
- `POST /api/intelligence/chat` (surfaced as the Chat tab on
  `/intelligence`) is, like the Insights tab, a small deterministic
  keyword router over the organization's own ledger/invoice/bill data —
  **not** a call to any language model or external AI provider. It only
  answers a fixed set of recognized questions (cash balance, overdue
  invoices, upcoming bills, recent profit) and states the calculation
  method (`basis`) behind every answer.

## Webhooks
- Outbound webhook subscriptions can be created and signed
  (HMAC-SHA256) via `src/lib/webhooks.ts`, but deliveries are only
  **logged**, not actually sent over HTTP — there is no public API
  surface yet that emits real events (`invoice.paid`, `bill.paid`,
  etc.) to trigger a dispatch. See
  [integration-adapters.md](integration-adapters.md).

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

