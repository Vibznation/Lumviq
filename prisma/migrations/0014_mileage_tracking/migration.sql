-- Mileage tracking (Lumviq Start and higher). Advertised on the pricing
-- page since launch but never implemented — this closes that gap with a
-- real, organization-scoped mileage log. Additive only.

CREATE TABLE IF NOT EXISTS mileage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date timestamptz NOT NULL,
  start_location text NOT NULL,
  end_location text NOT NULL,
  purpose text,
  miles numeric(10, 2) NOT NULL,
  rate_per_mile numeric(6, 3) NOT NULL,
  amount numeric(12, 2) NOT NULL,
  reimbursement_id uuid REFERENCES reimbursements(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_org ON mileage_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_mileage_logs_reimbursement ON mileage_logs(reimbursement_id);
