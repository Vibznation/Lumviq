-- Payroll provider totals: lets a business enter the results of an external
-- payroll provider's tax withholding/employer-tax calculation so the ledger
-- entry reflects net pay owed and taxes payable, not just gross wages.
-- Lumviq still does not calculate these amounts itself.

ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS total_employee_tax numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS total_employer_tax numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_runs ADD COLUMN IF NOT EXISTS total_net_pay numeric(20,6) NOT NULL DEFAULT 0;

ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS employee_tax numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE pay_run_lines ADD COLUMN IF NOT EXISTS net_pay numeric(20,6) NOT NULL DEFAULT 0;
