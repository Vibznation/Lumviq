import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceAddOnGroup } from '../../../lib/entitlements'

/**
 * Pay schedules (weekly/biweekly/semimonthly/monthly cadences). See
 * prisma/schema.prisma `PaySchedule` model. Employees are assigned to a
 * schedule via `PATCH /api/employees/[id]` (`payScheduleId`).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const schedules = await prisma.paySchedule.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } })
    return res.status(200).json(schedules)
  }

  if (req.method === 'POST') {
    const { organizationId, name, frequency, anchorDate, nextPayDate, autoPayrollEnabled } = req.body || {}
    if (!organizationId || !name || !anchorDate) return res.status(400).json({ error: 'organizationId, name and anchorDate are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceAddOnGroup(res, prisma, organizationId, 'payroll'))) return
    const schedule = await prisma.paySchedule.create({
      data: {
        organizationId,
        name,
        frequency: frequency || 'biweekly',
        anchorDate: new Date(anchorDate),
        nextPayDate: nextPayDate ? new Date(nextPayDate) : null,
        autoPayrollEnabled: Boolean(autoPayrollEnabled),
      },
    })
    return res.status(201).json(schedule)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
