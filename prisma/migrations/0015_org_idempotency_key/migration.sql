-- Add idempotency key to organizations to prevent duplicate-organization creation
-- from double-submits / retried onboarding requests. Nullable + unique, additive
-- and backward-compatible (mirrors journal_entries.idempotency_key pattern).
ALTER TABLE "organizations" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "organizations_idempotency_key_key" ON "organizations"("idempotency_key");
