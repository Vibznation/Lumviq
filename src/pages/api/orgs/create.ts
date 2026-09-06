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
  const { name, orgType, industry, planId, billingCycle, addOns } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  if (orgType && orgType !== 'business' && orgType !== 'nonprofit') {
    return res.status(400).json({ error: 'orgType must be "business" or "nonprofit"' })
  }
  const resolvedPlanId = planId && PLANS.some((p) => p.id === planId) ? planId : 'free'
  const resolvedBillingCycle = billingCycle === 'annual' ? 'annual' : 'monthly'
  const resolvedAddOns: string[] = Array.isArray(addOns) ? addOns.filter((id: string) => ADD_ONS.some((a) => a.id === id)) : []

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name,
        orgType: orgType || 'business',
        industry: industry || null,
        planId: resolvedPlanId,
        billingCycle: resolvedBillingCycle,
        addOns: resolvedAddOns,
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

  return res.status(201).json({ id: org.id, name: org.name, orgType: org.orgType, industry: org.industry, planId: org.planId })
}
