-- Scope custom Role rows to a single organization (previously Role.name
-- was globally unique across ALL organizations, and GET /api/roles
-- returned every organization's custom roles to any member). Backfills
-- organization_id from the role's existing memberships (first membership
-- created wins); any truly orphaned role (no membership ever referenced
-- it) is deleted since it can't be attributed to a tenant.

ALTER TABLE "roles" ADD COLUMN "organization_id" uuid;

UPDATE "roles" r
SET "organization_id" = sub.organization_id
FROM (
  SELECT DISTINCT ON (role_id) role_id, organization_id
  FROM "organization_memberships"
  WHERE role_id IS NOT NULL
  ORDER BY role_id, created_at ASC
) sub
WHERE r.id = sub.role_id;

DELETE FROM "role_permissions" WHERE role_id IN (SELECT id FROM "roles" WHERE organization_id IS NULL);
DELETE FROM "roles" WHERE organization_id IS NULL;

ALTER TABLE "roles" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "roles_name_key";
CREATE UNIQUE INDEX "roles_organization_id_name_key" ON "roles"("organization_id", "name");
CREATE INDEX "idx_roles_organization_id" ON "roles"("organization_id");
