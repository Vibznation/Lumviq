-- Full-service payroll expansion: extends Employee/PayRun/PayRunLine/
-- Contractor in place (no columns dropped or renamed) and adds the
-- supporting tables needed for a real payroll-run workflow layered on a
-- licensed embedded-payroll provider adapter (src/lib/integrations/payroll.ts).
-- Entirely additive; existing rows/behavior are unaffected until the new
-- columns/tables are populated by the new API routes.

-- ---------------------------------------------------------------------
-- New standalone tables first (referenced by ALTER TABLE ... ADD COLUMN
-- foreign keys below).
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pay_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  frequency text NOT NULL DEFAULT 'biweekly',
  anchor_date timestamptz NOT NULL,
  next_pay_date timestamptz,
  auto_payroll_enabled boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pay_schedules_org ON pay_schedules(organization_id);

-- ---------------------------------------------------------------------
-- Employees: onboarding, personal, tax-election-summary and
-- organizational fields.
-- ---------------------------------------------------------------------

ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS preferred_name text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_line1 text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_line2 text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth timestamptz;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ssn_encrypted text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS ssn_last4 text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS overtime_eligible boolean NOT NULL DEFAULT true;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'active';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date timestamptz;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS termination_date timestamptz;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES employees(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pay_schedule_id uuid REFERENCES pay_schedules(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'not_started';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS provider_employee_id text;
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_location ON employees(location_id);
CREATE INDEX IF NOT EXISTS idx_employees_pay_schedule ON employees(pay_schedule_id);

-- ---------------------------------------------------------------------
-- Pay runs: richer status workflow + provider/payment-date fields.
-- ---------------------------------------------------------------------

ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS pay_schedule_id uuid REFERENCES pay_schedules(id) ON DELETE SET NULL;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS off_cycle boolean NOT NULL DEFAULT false;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS total_pretax_deductions numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS total_posttax_deductions numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS total_garnishments numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS total_reimbursements numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS total_employer_benefits_cost numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS debit_date timestamptz;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS employee_payment_date timestamptz;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS tax_payment_date timestamptz;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS provider_payroll_id text;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS reversal_of_pay_run_id uuid REFERENCES pay_runs(id) ON DELETE SET NULL;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS prepared_by_user_id uuid;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS approved_by_user_id uuid;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS failure_reason text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pay_runs_reversal_of_pay_run_id_key'
  ) THEN
    ALTER TABLE pay_runs ADD CONSTRAINT pay_runs_reversal_of_pay_run_id_key UNIQUE (reversal_of_pay_run_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_pay_runs_pay_schedule ON pay_runs(pay_schedule_id);

-- ---------------------------------------------------------------------
-- Pay run lines: hours, deductions/garnishments/reimbursements,
-- employer-side costs, and cost-allocation.
-- ---------------------------------------------------------------------

ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS regular_hours numeric(9,2);
ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS overtime_hours numeric(9,2);
ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS pretax_deductions numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS posttax_deductions numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS garnishment_amount numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS reimbursements numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS employer_tax numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS employer_benefits_cost numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pay_run_lines_project ON pay_run_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_pay_run_lines_location ON pay_run_lines(location_id);

-- ---------------------------------------------------------------------
-- Contractors: W-9 / 1099 fields.
-- ---------------------------------------------------------------------

ALTER TABLE contractors ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS tax_classification text;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS tax_id_encrypted text;
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS w9_status text NOT NULL DEFAULT 'not_collected';
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'check';
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS provider_contractor_id text;

-- ---------------------------------------------------------------------
-- Remaining new tables.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS employee_tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  filing_status text NOT NULL DEFAULT 'single',
  federal_allowances int NOT NULL DEFAULT 0,
  federal_extra_withholding numeric(12,2) NOT NULL DEFAULT 0,
  state text,
  state_filing_status text,
  state_allowances int NOT NULL DEFAULT 0,
  state_extra_withholding numeric(12,2) NOT NULL DEFAULT 0,
  multi_state_work_states text[] NOT NULL DEFAULT '{}',
  exempt_from_federal boolean NOT NULL DEFAULT false,
  exempt_from_state boolean NOT NULL DEFAULT false,
  provider_tax_profile_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS direct_deposit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_type text NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  contractor_id uuid REFERENCES contractors(id) ON DELETE CASCADE,
  bank_name text,
  account_type text NOT NULL DEFAULT 'checking',
  routing_number_encrypted text NOT NULL,
  account_number_encrypted text NOT NULL,
  account_last4 text NOT NULL,
  split_type text NOT NULL DEFAULT 'remainder',
  split_value numeric(20,6),
  priority int NOT NULL DEFAULT 1,
  verification_status text NOT NULL DEFAULT 'pending',
  provider_account_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_direct_deposit_accounts_org ON direct_deposit_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_direct_deposit_accounts_employee ON direct_deposit_accounts(employee_id);
CREATE INDEX IF NOT EXISTS idx_direct_deposit_accounts_contractor ON direct_deposit_accounts(contractor_id);

CREATE TABLE IF NOT EXISTS deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  category text NOT NULL,
  tax_treatment text NOT NULL DEFAULT 'pretax',
  calculation_method text NOT NULL DEFAULT 'fixed_amount',
  employee_amount numeric(20,6) NOT NULL DEFAULT 0,
  employer_amount numeric(20,6) NOT NULL DEFAULT 0,
  annual_limit numeric(20,6),
  effective_date timestamptz NOT NULL,
  end_date timestamptz,
  priority int NOT NULL DEFAULT 1,
  provider_deduction_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deductions_employee ON deductions(employee_id);

CREATE TABLE IF NOT EXISTS garnishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  garnishment_type text NOT NULL,
  order_number text,
  issuing_agency text,
  calculation_method text NOT NULL DEFAULT 'fixed_amount',
  amount numeric(20,6) NOT NULL DEFAULT 0,
  max_percent_of_disposable numeric(5,2),
  priority int NOT NULL DEFAULT 1,
  remaining_balance numeric(20,6),
  effective_date timestamptz NOT NULL,
  end_date timestamptz,
  provider_garnishment_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_garnishments_employee ON garnishments(employee_id);

CREATE TABLE IF NOT EXISTS pto_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'vacation',
  accrual_method text NOT NULL DEFAULT 'per_pay_period',
  accrual_rate numeric(10,4) NOT NULL DEFAULT 0,
  max_balance numeric(10,2),
  carryover_limit numeric(10,2),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pto_policies_org ON pto_policies(organization_id);

CREATE TABLE IF NOT EXISTS pto_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pto_policy_id uuid NOT NULL REFERENCES pto_policies(id) ON DELETE CASCADE,
  balance_hours numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, pto_policy_id)
);

CREATE TABLE IF NOT EXISTS pto_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pto_policy_id uuid REFERENCES pto_policies(id) ON DELETE SET NULL,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  hours numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  decided_by_user_id uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pto_requests_employee ON pto_requests(employee_id);

CREATE TABLE IF NOT EXISTS tax_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  jurisdiction text NOT NULL,
  form_type text NOT NULL,
  filing_period_start timestamptz NOT NULL,
  filing_period_end timestamptz NOT NULL,
  due_date timestamptz NOT NULL,
  amount numeric(20,6),
  status text NOT NULL DEFAULT 'pending',
  provider_filing_id text,
  provider_confirmation text,
  failure_reason text,
  filed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_filings_org ON tax_filings(organization_id);

CREATE TABLE IF NOT EXISTS payroll_tax_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_type text NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  contractor_id uuid REFERENCES contractors(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  tax_year int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_document_id text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_tax_documents_org ON payroll_tax_documents(organization_id);

CREATE TABLE IF NOT EXISTS pay_stubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_run_id uuid NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  pay_run_line_id uuid NOT NULL UNIQUE REFERENCES pay_run_lines(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_date timestamptz NOT NULL,
  corrected_for_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pay_stubs_pay_run ON pay_stubs(pay_run_id);
CREATE INDEX IF NOT EXISTS idx_pay_stubs_employee ON pay_stubs(employee_id);

CREATE TABLE IF NOT EXISTS payroll_provider_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  external_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_provider_links_org ON payroll_provider_links(organization_id);

CREATE TABLE IF NOT EXISTS payroll_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_event_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_webhook_events_org ON payroll_webhook_events(organization_id);
