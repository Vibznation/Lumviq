import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest } from '../../../lib/authorization'
import { PLANS, ADD_ONS } from '../../../lib/plans'
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

    // Downgrades never delete data — only the organization's plan/add-on fields change.
    const updated = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: organizationId },
        data: { planId, billingCycle, addOns: addOnIds },
      })
      await tx.subscriptionEvent.create({
        data: { organizationId, planId, billingCycle, addOns: addOnIds, actorId: user.id },
      })
      return org
    })

    return res.status(200).json({ planId: updated.planId, billingCycle: updated.billingCycle, addOns: updated.addOns })
  }

  return res.status(405).end()
}
