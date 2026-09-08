/**
 * Server-side feature entitlements. Every gated action must check
 * entitlements here — never rely only on hiding UI elements client-side.
 *
 * Entitlements are derived from an organization's `planId` + `addOns`
 * (see prisma/schema.prisma `Organization` fields), resolved against the
 * plan/add-on definitions in src/lib/plans.ts. A downgrade never deletes
 * data; it only affects what new actions are permitted going forward.
 */
import { ADD_ONS, PLANS, getPlan, planHasFeature } from './plans'

export interface OrgBillingState {
  planId: string
  billingCycle: string
  addOns: string[]
}

export interface Entitlements {
  planId: string
  featureKeys: Set<string>
  limits: ReturnType<typeof getPlan>['limits']
  addOns: string[]
}

/** Resolves the full set of enabled feature keys for an org's plan + add-ons. */
export function resolveEntitlements(org: OrgBillingState): Entitlements {
  const plan = getPlan(org.planId)
  const featureKeys = new Set(plan.featureKeys)
  for (const addOnId of org.addOns) {
    const addOn = ADD_ONS.find((a) => a.id === addOnId)
    if (!addOn) continue // unknown/retired add-on id: ignore rather than throw, so old orgs never hard-fail
    // Add-ons don't currently map onto the FEATURE_CATALOG (they're separate
    // modules), but are tracked here so hasAddOn()/requireAddOn() can gate on them.
  }
  return { planId: plan.id, featureKeys, limits: plan.limits, addOns: org.addOns }
}

export function hasFeature(entitlements: Entitlements, featureKey: string): boolean {
  return entitlements.featureKeys.has(featureKey)
}

export function hasAddOn(entitlements: Entitlements, addOnId: string): boolean {
  return entitlements.addOns.includes(addOnId)
}

export class EntitlementError extends Error {
  upgradeMessage: string
  constructor(message: string, upgradeMessage: string) {
    super(message)
    this.name = 'EntitlementError'
    this.upgradeMessage = upgradeMessage
  }
}

function planNameFor(featureKey: string): string | null {
  const withFeature = PLANS.find((p) => p.featureKeys.includes(featureKey))
  return withFeature ? withFeature.name : null
}

/** Throws an EntitlementError with a helpful upgrade message if the feature isn't included. */
export function requireFeature(entitlements: Entitlements, featureKey: string): void {
  if (hasFeature(entitlements, featureKey)) return
  const requiredPlan = planNameFor(featureKey)
  const upgradeMessage = requiredPlan
    ? `This feature requires ${requiredPlan} or higher. Visit /pricing to upgrade.`
    : `This feature isn't available on your current plan. Visit /pricing to upgrade.`
  throw new EntitlementError(`Feature not entitled: ${featureKey}`, upgradeMessage)
}

/** Throws an EntitlementError if a numeric limit (e.g. users, invoicesPerMonth) would be exceeded. */
export function requireWithinLimit(entitlements: Entitlements, limitKey: keyof Entitlements['limits'], currentCount: number): void {
  const limit = entitlements.limits[limitKey]
  if (limit === 'unlimited') return
  if (currentCount < limit) return
  throw new EntitlementError(
    `Limit exceeded: ${String(limitKey)}`,
    `You've reached your plan's limit for this. Visit /pricing to upgrade for a higher limit.`
  )
}

/** Loads an organization's billing state and resolves entitlements. Pass a Prisma client or transaction. */
export async function getOrgEntitlements(tx: any, organizationId: string): Promise<Entitlements> {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { planId: true, billingCycle: true, addOns: true },
  })
  if (!org) throw new Error('Organization not found')
  return resolveEntitlements(org)
}

/**
 * Server-side entitlement gate for API routes. Call after the tenant
 * membership check, before performing the gated action. Returns `true`
 * when the organization's plan includes the feature (caller should
 * proceed); returns `false` and has already written a 403 JSON response
 * (`{ error, upgradeMessage }`) when it does not (caller must `return`
 * immediately). Never trust client-side UI locking alone — see
 * src/components/AppShell.tsx / src/pages/dashboard.tsx for the
 * corresponding (non-authoritative) client-side hiding.
 */
export async function enforceFeature(res: any, tx: any, organizationId: string, featureKey: string): Promise<boolean> {
  try {
    const entitlements = await getOrgEntitlements(tx, organizationId)
    requireFeature(entitlements, featureKey)
    return true
  } catch (err) {
    if (err instanceof EntitlementError) {
      res.status(403).json({ error: err.message, upgradeMessage: err.upgradeMessage })
      return false
    }
    throw err
  }
}

/**
 * Server-side numeric-limit gate for API routes (e.g. users,
 * invoicesPerMonth). `currentCount` must be computed by the caller
 * (e.g. a count query scoped to the relevant period). Same return-value
 * contract as enforceFeature.
 */
export async function enforceLimit(
  res: any,
  tx: any,
  organizationId: string,
  limitKey: keyof Entitlements['limits'],
  currentCount: number
): Promise<boolean> {
  try {
    const entitlements = await getOrgEntitlements(tx, organizationId)
    requireWithinLimit(entitlements, limitKey, currentCount)
    return true
  } catch (err) {
    if (err instanceof EntitlementError) {
      res.status(403).json({ error: err.message, upgradeMessage: err.upgradeMessage })
      return false
    }
    throw err
  }
}
