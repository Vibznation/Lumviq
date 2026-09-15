-- Employer payroll onboarding profile (one per organization)
CREATE TABLE IF NOT EXISTS payroll_company_profiles (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  legal_business_name  TEXT NOT NULL,
  entity_type          TEXT NOT NULL,
  ein_encrypted        TEXT,
  ein_last4            TEXT,
  address_line1        TEXT NOT NULL,
  address_line2        TEXT,
  city                 TEXT NOT NULL,
  state                TEXT NOT NULL,
  postal_code          TEXT NOT NULL,
  signatory_name       TEXT NOT NULL,
  signatory_title      TEXT NOT NULL,
  contact_email        TEXT NOT NULL,
  contact_phone        TEXT,
  onboarding_status    TEXT NOT NULL DEFAULT 'not_started',
  provider_company_id  TEXT,
  updated_at           TIMESTAMP(3) NOT NULL DEFAULT now(),
  created_at           TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- Payroll workplace / tax-jurisdiction fields on the existing Location table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_payroll_workplace BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS suta_account_number TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS suta_rate DECIMAL(6,4);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS provider_workplace_id TEXT;
