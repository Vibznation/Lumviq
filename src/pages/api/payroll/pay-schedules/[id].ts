import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const schedule = await prisma.paySchedule.findUnique({ where: { id } })
  if (!schedule) return res.status(404).json({ error: 'Pay schedule not found' })
  if (!(await userHasMembership(user.id, schedule.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'PATCH') {
    if (!(await enforceAddOnGroup(res, prisma, schedule.organizationId, 'payroll'))) return
    const body = req.body || {}
    const data: any = {}
    if (body.name !== undefined) data.name = body.name
    if (body.frequency !== undefined) data.frequency = body.frequency
    if (body.anchorDate !== undefined) data.anchorDate = new Date(body.anchorDate)
    if (body.nextPayDate !== undefined) data.nextPayDate = body.nextPayDate ? new Date(body.nextPayDate) : null
    if (body.autoPayrollEnabled !== undefined) data.autoPayrollEnabled = Boolean(body.autoPayrollEnabled)
    if (body.active !== undefined) data.active = Boolean(body.active)
    const updated = await prisma.paySchedule.update({ where: { id }, data })
    return res.status(200).json(updated)
  }

  res.setHeader('Allow', 'PATCH')
  return res.status(405).end()
}
