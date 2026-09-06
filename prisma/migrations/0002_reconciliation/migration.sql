-- Reconciliation and banking baseline
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text,
  name text NOT NULL,
  account_number text,
  currency text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  imported_at timestamptz NOT NULL DEFAULT now(),
  transaction_date date NOT NULL,
  amount numeric(20,6) NOT NULL,
  description text,
  external_id text,
  imported_file text,
  is_cleared boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS reconciliation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
  bank_transaction_id uuid NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
  matched boolean NOT NULL DEFAULT false,
  matched_to_journal_line_id uuid
);

CREATE INDEX IF NOT EXISTS idx_bank_tx_bank ON bank_transactions (bank_account_id);
CREATE INDEX IF NOT EXISTS idx_recon_session_org ON reconciliation_sessions (organization_id);
