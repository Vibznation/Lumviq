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
