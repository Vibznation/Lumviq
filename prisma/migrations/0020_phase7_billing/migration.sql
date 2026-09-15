-- Phase 7 (Billing & Entitlements): additive columns only.
ALTER TABLE "subscription_events" ADD COLUMN IF NOT EXISTS "event_type" TEXT;
