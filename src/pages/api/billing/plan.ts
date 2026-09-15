import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest } from '../../../lib/authorization'
import { PLANS, ADD_ONS, getPlan } from '../../../lib/plans'
import { resolveEntitlements } from '../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    const membership = await prisma.organizationMembership.findFirst({ where: { userId: user.id, organizationId } })
    if (!membership) return res.status(403).json({ error: 'Forbidden' })

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { planId: true, billingCycle: true, addOns: true },
    })
    if (!org) return res.status(404).json({ error: 'Organization not found' })

    const entitlements = resolveEntitlements(org)
    return res.status(200).json({
      planId: org.planId,
      billingCycle: org.billingCycle,
      addOns: org.addOns,
      limits: entitlements.limits,
      featureKeys: Array.from(entitlements.featureKeys),
    })
  }

  if (req.method === 'POST') {
    const { organizationId, planId, billingCycle, addOns } = req.body
    if (!organizationId || !planId || !billingCycle) {
      return res.status(400).json({ error: 'organizationId, planId and billingCycle are required' })
    }
    if (!PLANS.some((p) => p.id === planId)) return res.status(400).json({ error: 'Unknown planId' })
    if (billingCycle !== 'monthly' && billingCycle !== 'annual') return res.status(400).json({ error: 'billingCycle must be "monthly" or "annual"' })
    const addOnIds: string[] = Array.isArray(addOns) ? addOns.map(String) : []
    for (const id of addOnIds) {
      if (!ADD_ONS.some((a) => a.id === id)) return res.status(400).json({ error: `Unknown add-on id: ${id}` })
    }

    const membership = await prisma.organizationMembership.findFirst({ where: { userId: user.id, organizationId } })
    if (!membership || membership.role !== 'owner') return res.status(403).json({ error: 'Owner access required to change billing' })

    const currentOrg = await prisma.organization.findUnique({ where: { id: organizationId }, select: { planId: true } })
    if (!currentOrg) return res.status(404).json({ error: 'Organization not found' })

    const currentPlan = getPlan(currentOrg.planId)
    const newPlan = getPlan(planId)
    const currentRank = PLANS.findIndex((p) => p.id === currentPlan.id)
    const newRank = PLANS.findIndex((p) => p.id === newPlan.id)
    const isDowngrade = newRank < currentRank

    // A downgrade never deletes data, but it can silently strand an org
    // over its new plan's limits (e.g. 10 users on a plan that only
    // allows 3). Block the downgrade with a clear error rather than
    // letting it succeed and only failing later on unrelated actions.
    if (isDowngrade) {
      const memberCount = await prisma.organizationMembership.count({ where: { organizationId, role: { not: 'accountant' } } })
      const pendingInvites = await prisma.organizationInvitation.count({ where: { organizationId, role: { not: 'accountant' } } })
      const accountantCount = await prisma.organizationMembership.count({ where: { organizationId, role: 'accountant' } })
      const pendingAccountantInvites = await prisma.organizationInvitation.count({ where: { organizationId, role: 'accountant' } })
      const invoicesThisMonth = await prisma.invoice.count({
        where: { organizationId, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      })

      const violations: string[] = []
      const { limits } = newPlan
      if (limits.users !== 'unlimited' && memberCount + pendingInvites > limits.users) {
        violations.push(`users (${memberCount + pendingInvites} in use, plan allows ${limits.users})`)
      }
      if (limits.accountantInvitations !== 'unlimited' && accountantCount + pendingAccountantInvites > limits.accountantInvitations) {
        violations.push(`accountant invitations (${accountantCount + pendingAccountantInvites} in use, plan allows ${limits.accountantInvitations})`)
      }
      if (limits.invoicesPerMonth !== 'unlimited' && invoicesThisMonth > limits.invoicesPerMonth) {
        violations.push(`invoices this month (${invoicesThisMonth} used, plan allows ${limits.invoicesPerMonth})`)
      }
      if (violations.length > 0) {
        return res.status(409).json({
          error: `Cannot downgrade to ${newPlan.name}: current usage exceeds its limits for ${violations.join('; ')}.`,
        })
      }
    }

    const eventType = newRank > currentRank ? 'upgraded' : newRank < currentRank ? 'downgraded' : 'plan_changed'

    // Downgrades never delete data — only the organization's plan/add-on fields change.
    const updated = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: organizationId },
        data: { planId, billingCycle, addOns: addOnIds },
      })
      await tx.subscriptionEvent.create({
        data: { organizationId, planId, billingCycle, addOns: addOnIds, actorId: user.id, eventType },
      })
      return org
    })


    return res.status(200).json({ planId: updated.planId, billingCycle: updated.billingCycle, addOns: updated.addOns })
  }

  return res.status(405).end()
}
