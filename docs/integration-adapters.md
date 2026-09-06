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

## Webhooks (outbound, Lumviq → external systems) — `src/lib/webhooks.ts`
Unlike the three interfaces above (inbound provider integrations),
webhooks are an **outbound** integration point Lumviq itself exposes:
- `createWebhook(organizationId, url, eventTypes)` registers a
  subscription and generates an HMAC-SHA256 signing secret
  (`generateWebhookSecret` / `signPayload`, both using Node's built-in
  `crypto` module).
- `dispatchWebhookEvent(...)` records a `WebhookDelivery` row (status
  `not_sent`) but **does not perform the actual HTTP call yet** — there
  is no public API surface that emits real domain events
  (`invoice.paid`, `bill.paid`, etc.) to trigger dispatch. This is
  scaffolding for a future public API, not a working outbound webhook
  system today.

## Settings → Integrations page
`src/pages/settings/integrations.tsx` always displays each of the three
provider categories above as **"Not connected"**, consistent with the
lib-level stubs — this page is not a UI bug, it is an accurate reflection
of current capability.
