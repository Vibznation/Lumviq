import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'

/**
 * PTO balances for an employee, one row per PtoPolicy the employee
 * participates in. POST performs a manual admin correction/grant
 * (upsert) rather than the normal per-payrun accrual, which is applied
 * automatically by the payroll provider sync.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const employeeId = req.query.id as string
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return res.status(404).json({ error: 'Employee not found' })
  if (!(await userHasMembership(user.id, employee.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    const balances = await prisma.ptoBalance.findMany({
      where: { employeeId },
      include: { ptoPolicy: true },
      orderBy: { updatedAt: 'desc' },
    })
    return res.status(200).json(balances)
  }

  if (req.method === 'POST') {
    if (!(await enforceAddOnGroup(res, prisma, employee.organizationId, 'payroll'))) return
    const { ptoPolicyId, balanceHours } = req.body || {}
    if (!ptoPolicyId || balanceHours == null) return res.status(400).json({ error: 'ptoPolicyId and balanceHours are required' })
    const policy = await prisma.ptoPolicy.findUnique({ where: { id: ptoPolicyId } })
    if (!policy || policy.organizationId !== employee.organizationId) {
      return res.status(400).json({ error: 'PTO policy does not belong to this organization' })
    }
    const balance = await prisma.ptoBalance.upsert({
      where: { employeeId_ptoPolicyId: { employeeId, ptoPolicyId } },
      update: { balanceHours },
      create: { employeeId, ptoPolicyId, balanceHours },
    })
    return res.status(200).json(balance)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
