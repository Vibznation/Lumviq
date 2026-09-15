import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest } from '../../../../lib/authorization'

/**
 * Employee self-service paystubs: strictly scoped to the PayStub rows
 * belonging to the Employee record linked to the current user
 * (Employee.userId === user.id). No other employee's paystubs are ever
 * reachable through this endpoint, even for org admins — see
 * tests/payroll-self-service.test.ts for the isolation test.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })

  const employee = await prisma.employee.findFirst({ where: { organizationId, userId: user.id } })
  if (!employee) return res.status(404).json({ error: 'No employee record is linked to your account in this organization' })

  const payStubs = await prisma.payStub.findMany({
    where: { employeeId: employee.id },
    include: { payRunLine: true, payRun: { select: { payPeriodStart: true, payPeriodEnd: true, offCycle: true } } },
    orderBy: { payDate: 'desc' },
  })

  return res.status(200).json(payStubs)
}
