-- Phase 4 (Reporting): classify accounts for the cash-flow statement.
-- Nullable, additive, defaults to NULL (treated as 'operating' by src/lib/cash-flow.ts).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS cash_flow_category text;
