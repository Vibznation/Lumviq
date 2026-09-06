# Ledger Posting Matrix (Initial)

This matrix describes how operational workflows map to double-entry ledger postings for Lumviq MVP.

Principles
- Every operational document must result in a traceable journal entry (or entries).
- Posted entries are immutable; corrections use reversal and replacement entries.
- Posting operations are transactional and idempotent.

Sales / Receivables
- Invoice (posted)
  - Debit: Accounts Receivable (AR)
  - Credit: Revenue
- Customer payment
  - Debit: Bank/Cash
  - Credit: Accounts Receivable
- Credit note (refund/credit)
  - Debit: Revenue (or contra-revenue)
  - Credit: Accounts Receivable (or Cash if refunded)

Purchasing / Payables
- Bill (vendor invoice)
  - Debit: Expense (or Inventory)
  - Credit: Accounts Payable
- Vendor payment
  - Debit: Accounts Payable
  - Credit: Bank/Cash

Banking
- Bank import (unmatched)
  - Debit: Bank/Cash
  - Credit: Suspense/Unrecognized Income (temporary)
- Reconciliation match (when matched to invoice/payment)
  - Create offsetting clearing posts as needed (no net change to cash)

Inventory (placeholder)
- Receipt (stock-in)
  - Debit: Inventory (asset)
  - Credit: Goods-in-Transit or Accounts Payable (depending on workflow)
- COGS on sale
  - Debit: Cost of Goods Sold
  - Credit: Inventory

Payroll (placeholder)
- Payroll run (liabilities and net pay)
  - Debit: Wage Expense
  - Credit: Payroll Liabilities
  - Debit: Payroll Liabilities
  - Credit: Bank/Cash (when paid)

Adjusting and Closing
- Reversals: create reversing journal entry with negative amounts and reference original
- Period close: prevent postings into closed periods; use adjusting entries in open periods or reopen with controls

Notes
- All amounts use decimal(20,6) and are preserved as strings in API payloads to avoid floating-point issues.
- The posting matrix will be expanded for inventory valuation methods, multi-entity eliminations, and fund accounting in later phases.

*** End of document
