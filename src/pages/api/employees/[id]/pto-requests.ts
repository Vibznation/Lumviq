import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'

/**
 * Time-off requests for an employee. See prisma/schema.prisma
 * `PtoRequest` model. Requests are created here as 'pending'; a manager
 * approves/denies via `PATCH /api/pto-requests/[id]/decide`, which is
 * also where an approved request's hours are deducted from the
 * matching PtoBalance.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const employeeId = req.query.id as string
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return res.status(404).json({ error: 'Employee not found' })
  if (!(await userHasMembership(user.id, employee.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    const requests = await prisma.ptoRequest.findMany({
      where: { employeeId },
      include: { ptoPolicy: true },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(requests)
  }

  if (req.method === 'POST') {
    if (!(await enforceAddOnGroup(res, prisma, employee.organizationId, 'payroll'))) return
    const { ptoPolicyId, startDate, endDate, hours, reason } = req.body || {}
    if (!startDate || !endDate || hours == null) return res.status(400).json({ error: 'startDate, endDate and hours are required' })
    if (ptoPolicyId) {
      const policy = await prisma.ptoPolicy.findUnique({ where: { id: ptoPolicyId } })
      if (!policy || policy.organizationId !== employee.organizationId) {
        return res.status(400).json({ error: 'PTO policy does not belong to this organization' })
      }
    }
    const request = await prisma.ptoRequest.create({
      data: {
        employeeId,
        ptoPolicyId: ptoPolicyId || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        hours,
        reason: reason || null,
      },
    })
    return res.status(201).json(request)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
