-- Phase 5 (Banking & Integrations) remediation: additive, IF NOT EXISTS guards.

-- Link a bank account to its chart-of-accounts cash/bank account so
-- reconciliation matching can be scoped to the right ledger account
-- instead of comparing against every journal line in the org.
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

-- Optional statement ending balance for a reconciliation session, used
-- to surface a variance warning when finalizing (does not block closing).
ALTER TABLE reconciliation_sessions ADD COLUMN IF NOT EXISTS statement_ending_balance numeric(20,6);

-- The matched_to_journal_line_id column already existed as a plain uuid
-- with no referential constraint. Add a real FK (nullable, SET NULL on
-- delete so a later journal-line deletion doesn't break the reconciliation
-- audit trail) without altering existing data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reconciliation_items_matched_to_journal_line_id_fkey'
  ) THEN
    ALTER TABLE reconciliation_items
      ADD CONSTRAINT reconciliation_items_matched_to_journal_line_id_fkey
      FOREIGN KEY (matched_to_journal_line_id) REFERENCES journal_lines(id) ON DELETE SET NULL;
  END IF;
END $$;
