-- Add org_type and industry to organizations for onboarding
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS org_type text DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS industry text;
