-- Adds a payload column to approvals so the parameters needed to execute a
-- pending action (e.g. a bill payment's amount/date/account) can be stored
-- at request time and executed only once approved.

ALTER TABLE approvals ADD COLUMN IF NOT EXISTS payload jsonb;
