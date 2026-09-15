import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'

/**
 * Employee benefit/pretax/posttax deductions (health insurance, 401k,
 * HSA, etc.). See prisma/schema.prisma `Deduction` model.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const employeeId = req.query.id as string
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return res.status(404).json({ error: 'Employee not found' })
  if (!(await userHasMembership(user.id, employee.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    const deductions = await prisma.deduction.findMany({ where: { employeeId }, orderBy: { priority: 'asc' } })
    return res.status(200).json(deductions)
  }

  if (req.method === 'POST') {
    if (!(await enforceAddOnGroup(res, prisma, employee.organizationId, 'payroll'))) return
    const { category, taxTreatment, calculationMethod, employeeAmount, employerAmount, annualLimit, effectiveDate, priority } = req.body || {}
    if (!category || !effectiveDate) return res.status(400).json({ error: 'category and effectiveDate are required' })
    const deduction = await prisma.deduction.create({
      data: {
        employeeId,
        category,
        taxTreatment: taxTreatment || 'pretax',
        calculationMethod: calculationMethod || 'fixed_amount',
        employeeAmount: employeeAmount ?? 0,
        employerAmount: employerAmount ?? 0,
        annualLimit: annualLimit ?? null,
        effectiveDate: new Date(effectiveDate),
        priority: priority ?? 1,
      },
    })
    return res.status(201).json(deduction)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
