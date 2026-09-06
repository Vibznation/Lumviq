-- Feature-completion pass: estimates, purchase orders, recurring
-- invoice/bill templates, vendor credits, expense reimbursements,
-- multi-location inventory, project staff allocation, nonprofit
-- donations/pledges + fund tagging on journal entries, custom fields,
-- workflow automation rules, custom KPIs, budget scenarios, configurable
-- approval thresholds, and support tickets. All additive.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS approval_thresholds jsonb;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS fund_id uuid REFERENCES funds(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_fund ON journal_entries(fund_id);

CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  estimate_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  issue_date timestamptz NOT NULL,
  expiry_date timestamptz,
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric(20, 6) NOT NULL,
  tax_rate_id uuid,
  tax_total numeric(20, 6) NOT NULL DEFAULT 0,
  total numeric(20, 6) NOT NULL,
  converted_invoice_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, estimate_number)
);
CREATE INDEX IF NOT EXISTS idx_estimates_org ON estimates(organization_id);

CREATE TABLE IF NOT EXISTS estimate_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(20, 6) NOT NULL DEFAULT 1,
  unit_price numeric(20, 6) NOT NULL,
  amount numeric(20, 6) NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  product_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_estimate ON estimate_lines(estimate_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  po_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  issue_date timestamptz NOT NULL,
  expected_date timestamptz,
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric(20, 6) NOT NULL,
  total numeric(20, 6) NOT NULL,
  converted_bill_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, po_number)
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org ON purchase_orders(organization_id);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(20, 6) NOT NULL DEFAULT 1,
  unit_price numeric(20, 6) NOT NULL,
  amount numeric(20, 6) NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  product_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_po ON purchase_order_lines(purchase_order_id);

CREATE TABLE IF NOT EXISTS recurring_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  party_id uuid NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly',
  next_run_date timestamptz NOT NULL,
  last_run_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  tax_rate_id uuid,
  template_lines jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_org ON recurring_templates(organization_id);

CREATE TABLE IF NOT EXISTS vendor_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  credit_number text NOT NULL,
  amount numeric(20, 6) NOT NULL,
  remaining_amount numeric(20, 6) NOT NULL,
  reason text,
  expense_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  journal_entry_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, credit_number)
);
CREATE INDEX IF NOT EXISTS idx_vendor_credits_org ON vendor_credits(organization_id);

CREATE TABLE IF NOT EXISTS reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid,
  payee_name text NOT NULL,
  amount numeric(20, 6) NOT NULL,
  description text,
  expense_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  payment_account_id uuid,
  status text NOT NULL DEFAULT 'pending',
  journal_entry_id uuid UNIQUE,
  requested_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reimbursements_org ON reimbursements(organization_id);

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id);

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stock_movements_location ON stock_movements(location_id);

CREATE TABLE IF NOT EXISTS project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  allocation_percent numeric(5, 2) NOT NULL DEFAULT 100,
  role_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_project_assignments_org ON project_assignments(organization_id);

CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  donor_name text NOT NULL,
  donor_email text,
  amount numeric(20, 6) NOT NULL,
  date timestamptz NOT NULL,
  fund_id uuid REFERENCES funds(id) ON DELETE SET NULL,
  method text,
  deposit_account_id uuid NOT NULL,
  journal_entry_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_donations_org ON donations(organization_id);

CREATE TABLE IF NOT EXISTS pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  donor_name text NOT NULL,
  donor_email text,
  amount numeric(20, 6) NOT NULL,
  pledge_date timestamptz NOT NULL,
  due_date timestamptz,
  fulfilled_amount numeric(20, 6) NOT NULL DEFAULT 0,
  fund_id uuid REFERENCES funds(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pledges_org ON pledges(organization_id);

CREATE TABLE IF NOT EXISTS custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  name text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  options text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, entity_type, name)
);
CREATE INDEX IF NOT EXISTS idx_custom_fields_org ON custom_fields(organization_id, entity_type);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_field_id uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (custom_field_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field ON custom_field_values(custom_field_id);

CREATE TABLE IF NOT EXISTS workflow_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb,
  action_type text NOT NULL DEFAULT 'notify',
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workflow_rules_org ON workflow_rules(organization_id);

CREATE TABLE IF NOT EXISTS kpi_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_ids text[] NOT NULL DEFAULT '{}',
  operation text NOT NULL DEFAULT 'sum',
  target_value numeric(20, 6),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kpi_definitions_org ON kpi_definitions(organization_id);

CREATE TABLE IF NOT EXISTS budget_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  based_on_actual boolean NOT NULL DEFAULT false,
  adjustments jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_scenarios_org ON budget_scenarios(organization_id);

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'standard',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(organization_id);
