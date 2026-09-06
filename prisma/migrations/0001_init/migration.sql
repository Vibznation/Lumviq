-- Baseline migration for Lumviq (generated)
-- Creates core schema matching Prisma models

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  password_hash text,
  email_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Roles & Permissions
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text
);

CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE (role_id, permission_id)
);

-- Organization membership
CREATE TABLE IF NOT EXISTS organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL,
  role_id uuid NULL REFERENCES roles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  subtype text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounts_org ON accounts (organization_id);

-- Fiscal years and accounting periods
CREATE TABLE IF NOT EXISTS fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_years_org ON fiscal_years (organization_id);

CREATE TABLE IF NOT EXISTS accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year_id uuid NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_closed boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_fy ON accounting_periods (fiscal_year_id);

-- Journal entries and lines
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description text,
  posted boolean NOT NULL DEFAULT false,
  posted_at timestamptz,
  posting_user_id uuid,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_org ON journal_entries (organization_id);

CREATE TABLE IF NOT EXISTS journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  description text,
  amount numeric(20,6) NOT NULL,
  is_debit boolean NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines (account_id);

-- Organization invitations
CREATE TABLE IF NOT EXISTS organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_org_inv_org ON organization_invitations (organization_id);

-- Audit events
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  actor_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  previous_state jsonb,
  new_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_org ON audit_events (organization_id);

-- End of baseline migration
