# Integration adapter documentation

Lumviq defines TypeScript **interfaces** for three categories of external
integration. None of them are connected to a live third-party provider —
every adapter is a stub that returns a "not connected" / simulated result.
This is intentional scaffolding so a real provider can be dropped in
later without changing call sites. See
[known-limitations.md](known-limitations.md) for the user-facing
disclosure of this scope boundary.

## Bank feeds — `src/lib/integrations/bank-feed.ts`
```ts
export interface BankFeedProvider {
  fetchTransactions(accountId: string, since?: Date): Promise<BankFeedTransaction[]>
  isConnected(organizationId: string): Promise<boolean>
}
```
- No implementation is registered. The Banking page only supports manual
  CSV/OFX import (`src/pages/api/banking/import.ts`) and manual
  reconciliation (`src/pages/api/banking/reconcile/*`).
- To add a real provider (e.g. Plaid): implement `BankFeedProvider`,
  register it behind a factory function, and store provider credentials
  per-organization (never in source control — see
  [security-notes.md](security-notes.md)).

## Payments — `src/lib/integrations/payments.ts`
```ts
export interface PaymentProcessor {
  createPaymentIntent(invoiceId: string, amountMinor: number): Promise<PaymentIntentResult>
  isConnected(organizationId: string): Promise<boolean>
}
```
- No implementation is registered. Invoice payments are recorded manually
  via `POST /api/invoices/[id]/payments` — no card/ACH collection exists.
- The "Lumviq Payments" add-on is priced and shown in the billing UI but
  is not functionally connected to any processor; `/pricing` explicitly
  discloses this.

## OCR (receipt/bill scanning) — `src/lib/integrations/ocr.ts`
```ts
export interface OcrProvider {
  extractBillFields(fileBuffer: Buffer, mimeType: string): Promise<OcrExtractionResult>
  isConnected(organizationId: string): Promise<boolean>
}
```
- No implementation is registered. Bills/expenses must be entered
  manually; the new [Documents](../src/lib/documents.ts) feature lets
  files be attached to a bill/invoice for record-keeping, but does not
  extract any data from them.

## Payroll — `src/lib/integrations/payroll.ts` + `payroll-sandbox.ts`
```ts
export interface PayrollProvider {
  readonly name: string
  isConfigured(): boolean
  // ...20+ methods: company/employee/contractor onboarding, bank account
  // + tax profile configuration, pay schedules, calculate/preview/approve/
  // cancel/void/off-cycle payroll, paystubs, tax liabilities/filings/
  // documents, payment status, inbound webhook verification.
}
```
- Unlike the three adapters above, this one ships a genuine
  `SandboxPayrollProvider` implementation (deterministic, clearly
  documented as non-authoritative flat-rate FICA/federal/state/FUTA/SUTA
  approximations) so the full payroll-run workflow
  (`src/lib/payroll-run.ts`: draft → calculate → awaiting_approval →
  approve → submit → sync-to-paid/completed, plus cancel/void) can be
  built and exercised end-to-end before a real licensed provider (Check,
  Gusto Embedded, or similar) is contracted.
- `getPayrollProvider()` only returns the sandbox instance when
  `PAYROLL_PROVIDER_MODE=sandbox` is explicitly set; every other
  environment (including production by default) correctly reports "no
  payroll provider connected" and every provider-dependent action
  (`calculatePayRun`, `submitApprovedPayRun`, `syncPayRunStatus`,
  `cancelPayRun`, `voidPayRun`) throws `PayrollProviderNotConnectedError`.
- Manual-entry payroll (enter a licensed provider's totals by hand, then
  `POST /api/pay-runs` → `POST /api/pay-runs/[id]/post`) still works
  exactly as before and does not require a connected provider —
  `src/lib/payroll.ts`'s `postPayRunToLedger` only records the accounting
  impact of whatever totals it's given.
- Inbound webhook receiver: `POST /api/webhooks/payroll` verifies the
  signature via the provider's `handleWebhook()`, records a
  `PayrollWebhookEvent` row for idempotency (unique on
  `[provider, externalEventId]`), then calls `syncPayRunStatus` — which
  is also the only place a pay run gets posted to the ledger under the
  provider workflow, and only once the provider reports `paid`/`completed`.
- SSNs and bank routing/account numbers are encrypted at rest via
  `src/lib/encryption.ts` (AES-256-GCM, `FIELD_ENCRYPTION_KEY` required in
  production) — the first field-level PII encryption in this codebase.
- Separation of duties: `src/lib/approvals.ts`'s `executeApprovedAction`
  throws `SeparationOfDutiesError` if the user deciding a `payroll-run`
  approval is the same user who requested it (i.e. the preparer cannot
  also approve their own pay run).
- To connect a real provider: implement `PayrollProvider` against the
  provider's SDK, register it in `getPayrollProvider()`'s factory instead
  of (or alongside, behind its own explicit mode flag) the sandbox
  instance, and store provider credentials per-organization (never in
  source control — see [security-notes.md](security-notes.md)). No call
  site changes are needed elsewhere.

## Webhooks (outbound, Lumviq → external systems) — `src/lib/webhooks.ts`
Unlike the three interfaces above (inbound provider integrations),
webhooks are an **outbound** integration point Lumviq itself exposes:
- `createWebhook(organizationId, url, eventTypes)` registers a
  subscription and generates an HMAC-SHA256 signing secret
  (`generateWebhookSecret` / `signPayload`, both using Node's built-in
  `crypto` module).
- `dispatchWebhookEvent(...)` records a `WebhookDelivery` row (status
  `pending`) and enqueues a `webhook.delivery` background job
  (`src/lib/jobs.ts`). `sendWebhookDelivery(...)` performs the real
  signed HTTP POST (native `fetch`, `X-Lumviq-Signature` header) and
  updates the delivery to `delivered`/`failed`. Delivery only actually
  happens when something processes the job queue — see
  "Background jobs" below. Existing `dispatchWebhookEvent` call sites
  are unchanged from before; no new real-event emission points were
  added alongside this delivery mechanism.

## Background jobs — `src/lib/jobs.ts`
A durable, DB-backed queue (`BackgroundJob` table) used for webhook
delivery and outbound email. `enqueueJob(tx, params)` inserts a job;
`POST /api/jobs/process` (auth: `JOBS_PROCESS_SECRET` bearer token or a
logged-in user) calls `processDueJobs(...)` to run all due jobs once.
**There is no in-process scheduler** — an external cron (e.g. a Vercel
Cron Job) must call that endpoint periodically for jobs to actually run
in production. Failed jobs retry with exponential backoff (1, 5, 15, 60,
240 minutes) up to `maxAttempts` (default 5).

## Email — `src/lib/integrations/email.ts`
`sendEmail(message)` sends real SMTP mail via `nodemailer` only when
`SMTP_HOST`/`SMTP_PORT`/`SMTP_FROM` are configured; otherwise the message
is logged only, never faked as delivered. Every attempt is recorded in
the `EmailLog` table. Currently only the organization-invite flow uses
this (`POST /api/orgs/invite`).

## Settings → Integrations page
`src/pages/settings/integrations.tsx` displays Bank feeds/Payments/OCR as
**"Not connected"** and Payroll as **"Not connected"** or **"Sandbox (test
mode)"** (fetched live from `GET /api/integrations/payroll-status`),
consistent with the lib-level stubs — this page is not a UI bug, it is an
accurate reflection of current capability.
