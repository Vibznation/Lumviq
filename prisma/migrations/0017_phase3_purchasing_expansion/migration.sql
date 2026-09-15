-- Phase 3 (Purchasing) remediation: vendor profile fields (payment terms,
-- tax id) used for vendor detail history. All other Phase 3 infrastructure
-- (PurchaseOrderReceipt/3-way-match, VendorCredit.apply, Approval) already
-- exists in the schema from earlier migrations -- this migration only adds
-- the new vendor columns. Additive.

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tax_id text;
