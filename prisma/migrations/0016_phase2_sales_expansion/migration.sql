-- Phase 2 (Sales) remediation: per-line discounts, invoice payment-term
-- presets, organization branding (logo/color for invoices and the
-- customer portal), and sales-side credit notes + cash refunds mirroring
-- the existing AP-side vendor_credits pattern. All additive.

ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS discount numeric(20, 6) NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS brand_color text;

CREATE TABLE IF NOT EXISTS credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  credit_number text NOT NULL,
  amount numeric(20, 6) NOT NULL,
  remaining_amount numeric(20, 6) NOT NULL,
  reason text,
  income_account_id uuid NOT NULL,
  journal_entry_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, credit_number)
);
CREATE INDEX IF NOT EXISTS idx_credit_notes_org ON credit_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer ON credit_notes(customer_id);

CREATE TABLE IF NOT EXISTS invoice_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount numeric(20, 6) NOT NULL,
  refund_date timestamptz NOT NULL,
  reason text,
  deposit_account_id uuid NOT NULL,
  journal_entry_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_refunds_org ON invoice_refunds(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoice_refunds_invoice ON invoice_refunds(invoice_id);
