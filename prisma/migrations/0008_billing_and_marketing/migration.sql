-- Billing/marketing: adds plan/billing-cycle/add-on tracking to
-- organizations, a subscription change history table, and a table for
-- public contact-sales form submissions. No existing accounting data or
-- behavior is affected; all new columns default to the free plan.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_id text NOT NULL DEFAULT 'free';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS add_ons text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  billing_cycle text NOT NULL,
  add_ons text[] NOT NULL DEFAULT '{}',
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_org ON subscription_events(organization_id);

CREATE TABLE IF NOT EXISTS contact_sales_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  organization_name text NOT NULL,
  organization_type text,
  employee_count text,
  current_system text,
  required_modules text[] NOT NULL DEFAULT '{}',
  preferred_contact text,
  message text,
  consent_acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
