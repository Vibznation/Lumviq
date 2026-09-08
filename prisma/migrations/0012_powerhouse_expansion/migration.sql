-- Powerhouse expansion pass: background job queue, real email delivery
-- log, general-ledger account reconciliation, period-close checklist,
-- fixed assets/depreciation, loans/amortization, multi-line expense
-- report lines, PO goods receipts (3-way match), customer/vendor guest
-- portal tokens, and intercompany transactions for consolidation. All
-- additive.

CREATE TABLE IF NOT EXISTS background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status_run_at ON background_jobs(status, run_at);

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  to_address text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'logged_only',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_org ON email_logs(organization_id);

CREATE TABLE IF NOT EXISTS account_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period_end_date timestamptz NOT NULL,
  statement_balance numeric(20, 6) NOT NULL,
  gl_balance numeric(20, 6) NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  notes text,
  reconciled_by_user_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_reconciliations_org ON account_reconciliations(organization_id);
CREATE INDEX IF NOT EXISTS idx_account_reconciliations_account ON account_reconciliations(account_id);

ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS account_reconciliation_id uuid REFERENCES account_reconciliations(id) ON DELETE SET NULL;
ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS cleared_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_reconciliation ON journal_lines(account_reconciliation_id);

CREATE TABLE IF NOT EXISTS close_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  accounting_period_id uuid NOT NULL REFERENCES accounting_periods(id) ON DELETE CASCADE,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  assigned_to_user_id uuid,
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_close_checklist_items_period ON close_checklist_items(accounting_period_id);

CREATE TABLE IF NOT EXISTS fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  asset_account_id uuid NOT NULL,
  depreciation_expense_account_id uuid NOT NULL,
  accumulated_depreciation_account_id uuid NOT NULL,
  acquisition_date timestamptz NOT NULL,
  cost numeric(20, 6) NOT NULL,
  salvage_value numeric(20, 6) NOT NULL DEFAULT 0,
  useful_life_months int NOT NULL,
  method text NOT NULL DEFAULT 'straight_line',
  disposed_at timestamptz,
  disposal_amount numeric(20, 6),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_org ON fixed_assets(organization_id);

CREATE TABLE IF NOT EXISTS depreciation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_asset_id uuid NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  period_date timestamptz NOT NULL,
  amount numeric(20, 6) NOT NULL,
  journal_entry_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fixed_asset_id, period_date)
);

CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  lender_name text,
  liability_account_id uuid NOT NULL,
  interest_expense_account_id uuid NOT NULL,
  disbursement_account_id uuid,
  principal numeric(20, 6) NOT NULL,
  interest_rate_percent numeric(8, 4) NOT NULL,
  term_months int NOT NULL,
  start_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loans_org ON loans(organization_id);

CREATE TABLE IF NOT EXISTS loan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  payment_date timestamptz NOT NULL,
  amount numeric(20, 6) NOT NULL,
  principal_portion numeric(20, 6) NOT NULL,
  interest_portion numeric(20, 6) NOT NULL,
  journal_entry_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loan_id, payment_date)
);

CREATE TABLE IF NOT EXISTS reimbursement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id uuid NOT NULL REFERENCES reimbursements(id) ON DELETE CASCADE,
  date timestamptz NOT NULL,
  description text NOT NULL,
  amount numeric(20, 6) NOT NULL,
  expense_account_id uuid NOT NULL,
  document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reimbursement_lines_reimbursement ON reimbursement_lines(reimbursement_id);

CREATE TABLE IF NOT EXISTS purchase_order_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  received_date timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_receipts_po ON purchase_order_receipts(purchase_order_id);

CREATE TABLE IF NOT EXISTS purchase_order_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_receipt_id uuid NOT NULL REFERENCES purchase_order_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id uuid NOT NULL,
  quantity_received numeric(20, 6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_po_receipt_lines_receipt ON purchase_order_receipt_lines(purchase_order_receipt_id);

CREATE TABLE IF NOT EXISTS invoice_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_portal_tokens_invoice ON invoice_portal_tokens(invoice_id);

CREATE TABLE IF NOT EXISTS vendor_upload_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_upload_tokens_vendor ON vendor_upload_tokens(vendor_id);

CREATE TABLE IF NOT EXISTS intercompany_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  counterparty_organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description text,
  amount numeric(20, 6) NOT NULL,
  due_to_account_id uuid NOT NULL,
  due_from_account_id uuid NOT NULL,
  journal_entry_id uuid UNIQUE,
  counterparty_journal_entry_id uuid UNIQUE,
  eliminated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intercompany_org ON intercompany_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_intercompany_counterparty ON intercompany_transactions(counterparty_organization_id);
