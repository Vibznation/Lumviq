import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceAddOnGroup } from '../../../lib/entitlements'

/**
 * Organization-level PTO/sick-leave accrual policies. See
 * prisma/schema.prisma `PtoPolicy` model. Employees accrue against a
 * policy via `PtoBalance` (see [id]/pto-balances.ts on the employee).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const policies = await prisma.ptoPolicy.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } })
    return res.status(200).json(policies)
  }

  if (req.method === 'POST') {
    const { organizationId, name, category, accrualMethod, accrualRate, maxBalance, carryoverLimit } = req.body || {}
    if (!organizationId || !name) return res.status(400).json({ error: 'organizationId and name are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceAddOnGroup(res, prisma, organizationId, 'payroll'))) return
    const policy = await prisma.ptoPolicy.create({
      data: {
        organizationId,
        name,
        category: category || 'vacation',
        accrualMethod: accrualMethod || 'per_pay_period',
        accrualRate: accrualRate ?? 0,
        maxBalance: maxBalance ?? null,
        carryoverLimit: carryoverLimit ?? null,
      },
    })
    return res.status(201).json(policy)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
