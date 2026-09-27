import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const policy = await prisma.ptoPolicy.findUnique({ where: { id } })
  if (!policy) return res.status(404).json({ error: 'PTO policy not found' })
  if (!(await userHasMembership(user.id, policy.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'PATCH') {
    if (!(await enforceAddOnGroup(res, prisma, policy.organizationId, 'payroll'))) return
    const body = req.body || {}
    const data: any = {}
    if (body.name !== undefined) data.name = body.name
    if (body.category !== undefined) data.category = body.category
    if (body.accrualMethod !== undefined) data.accrualMethod = body.accrualMethod
    if (body.accrualRate !== undefined) data.accrualRate = body.accrualRate
    if (body.maxBalance !== undefined) data.maxBalance = body.maxBalance ?? null
    if (body.carryoverLimit !== undefined) data.carryoverLimit = body.carryoverLimit ?? null
    if (body.active !== undefined) data.active = Boolean(body.active)
    const updated = await prisma.ptoPolicy.update({ where: { id }, data })
    return res.status(200).json(updated)
  }

  res.setHeader('Allow', 'PATCH')
  return res.status(405).end()
}
