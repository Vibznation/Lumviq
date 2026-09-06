/**
 * Support-tier resolution derived from an organization's plan (see
 * src/lib/plans.ts). There is no live chat or third-party ticketing
 * integration — this only determines the expected response-time copy
 * shown in-app and stamped onto SupportTicket.priority.
 */
import { getPlan } from './plans'

export interface SupportTier {
  level: 'community' | 'standard' | 'priority' | 'dedicated'
  label: string
  responseTime: string
  channels: string[]
}

const TIERS: Record<string, SupportTier> = {
  free: { level: 'community', label: 'Community support', responseTime: 'Best-effort via community resources', channels: ['Help Center', 'Community forum'] },
  start: { level: 'standard', label: 'Standard support', responseTime: 'Within 2 business days', channels: ['Help Center', 'Email'] },
  grow: { level: 'priority', label: 'Priority support', responseTime: 'Within 1 business day', channels: ['Help Center', 'Email', 'Priority queue'] },
  scale: { level: 'priority', label: 'Priority support + guided onboarding', responseTime: 'Within 4 business hours', channels: ['Help Center', 'Email', 'Priority queue', 'Guided onboarding'] },
  enterprise: { level: 'dedicated', label: 'Dedicated account management', responseTime: 'Same business day', channels: ['Help Center', 'Email', 'Dedicated account manager', 'Training'] },
}

export function supportTierForPlan(planId: string): SupportTier {
  return TIERS[planId] || TIERS.free
}

export function supportTierLabel(planId: string): string {
  const plan = getPlan(planId)
  return `${plan.name}: ${supportTierForPlan(planId).label}`
}
