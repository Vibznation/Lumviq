-- Add unique constraint to prevent multiple reconciliation items for the same bank transaction
-- IMPORTANT: If duplicate rows already exist, run the cleanup SQL below before applying this constraint.

-- Cleanup duplicates (keep the first row per bank_transaction_id)
-- WITH duplicates AS (
--   SELECT id, bank_transaction_id, ROW_NUMBER() OVER (PARTITION BY bank_transaction_id ORDER BY id) as rn
--   FROM reconciliation_items
-- )
-- DELETE FROM reconciliation_items WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

ALTER TABLE reconciliation_items
ADD CONSTRAINT uq_reconciliation_items_bank_tx UNIQUE (bank_transaction_id);
