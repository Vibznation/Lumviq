import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { verifyToken } from '../../../lib/auth'
import { defaultChartOfAccounts } from '../../../lib/default-accounts'
import { PLANS, ADD_ONS } from '../../../lib/plans'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  const token = auth.split(' ')[1]
  const payload = verifyToken(token)
  if (!payload || !payload.userId) return res.status(401).json({ error: 'Invalid token' })
  const { name, orgType, industry, planId, billingCycle, addOns, idempotencyKey } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  if (orgType && orgType !== 'business' && orgType !== 'nonprofit') {
    return res.status(400).json({ error: 'orgType must be "business" or "nonprofit"' })
  }
  const resolvedPlanId = planId && PLANS.some((p) => p.id === planId) ? planId : 'free'
  const resolvedBillingCycle = billingCycle === 'annual' ? 'annual' : 'monthly'
  const resolvedAddOns: string[] = Array.isArray(addOns) ? addOns.filter((id: string) => ADD_ONS.some((a) => a.id === id)) : []
  const resolvedIdempotencyKey: string | null = typeof idempotencyKey === 'string' && idempotencyKey.length > 0 ? idempotencyKey : null

  // Idempotency guard: if this exact create-request (by key) already succeeded
  // (e.g. the client retried after a dropped response, or double-submitted the
  // onboarding form), return the existing organization instead of creating a
  // duplicate. Only honors the key if the requesting user already has access
  // to that organization, so a key can't be reused to read another org's data.
  if (resolvedIdempotencyKey) {
    const existingOrg = await prisma.organization.findUnique({ where: { idempotencyKey: resolvedIdempotencyKey } })
    if (existingOrg) {
      const membership = await prisma.organizationMembership.findFirst({ where: { userId: payload.userId, organizationId: existingOrg.id } })
      if (membership) {
        return res.status(200).json({ id: existingOrg.id, name: existingOrg.name, orgType: existingOrg.orgType, industry: existingOrg.industry, planId: existingOrg.planId })
      }
    }
  }

  let org
  try {
    org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name,
        orgType: orgType || 'business',
        industry: industry || null,
        planId: resolvedPlanId,
        billingCycle: resolvedBillingCycle,
        addOns: resolvedAddOns,
        idempotencyKey: resolvedIdempotencyKey,
      },
    })
    await tx.organizationMembership.create({
      data: { userId: payload.userId, organizationId: created.id, role: 'owner' },
    })
    await tx.subscriptionEvent.create({
      data: {
        organizationId: created.id,
        planId: resolvedPlanId,
        billingCycle: resolvedBillingCycle,
        addOns: resolvedAddOns,
        actorId: payload.userId,
      },
    })

    // Seed a starting chart of accounts so the org isn't empty on first login.
    await tx.account.createMany({
      data: defaultChartOfAccounts(orgType).map((a) => ({
        organizationId: created.id,
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
      })),
    })

    // Seed the current fiscal year (calendar year) with one open accounting period.
    const now = new Date()
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), 11, 31))
    const fiscalYear = await tx.fiscalYear.create({
      data: { organizationId: created.id, startDate, endDate },
    })
    await tx.accountingPeriod.create({
      data: { fiscalYearId: fiscalYear.id, startDate, endDate, isClosed: false },
    })

    return created
    })
  } catch (err: any) {
    // Race condition: two concurrent requests with the same idempotency key.
    // The unique constraint rejects the second insert — treat it the same as
    // the pre-check above and return the winning organization.
    if (err?.code === 'P2002' && resolvedIdempotencyKey) {
      const existingOrg = await prisma.organization.findUnique({ where: { idempotencyKey: resolvedIdempotencyKey } })
      if (existingOrg) {
        return res.status(200).json({ id: existingOrg.id, name: existingOrg.name, orgType: existingOrg.orgType, industry: existingOrg.industry, planId: existingOrg.planId })
      }
    }
    throw err
  }

  return res.status(201).json({ id: org.id, name: org.name, orgType: org.orgType, industry: org.industry, planId: org.planId })
}
