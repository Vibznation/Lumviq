import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'

/**
 * Legally-ordered wage garnishments (child support, tax levy, creditor
 * garnishment, etc.). See prisma/schema.prisma `Garnishment` model.
 * Lumviq applies the provider's withholding calculation and does not
 * give legal advice about priority ordering between multiple orders.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const employeeId = req.query.id as string
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return res.status(404).json({ error: 'Employee not found' })
  if (!(await userHasMembership(user.id, employee.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    const garnishments = await prisma.garnishment.findMany({ where: { employeeId }, orderBy: { priority: 'asc' } })
    return res.status(200).json(garnishments)
  }

  if (req.method === 'POST') {
    if (!(await enforceAddOnGroup(res, prisma, employee.organizationId, 'payroll'))) return
    const { garnishmentType, orderNumber, issuingAgency, calculationMethod, amount, maxPercentOfDisposable, priority, effectiveDate } = req.body || {}
    if (!garnishmentType || !effectiveDate) return res.status(400).json({ error: 'garnishmentType and effectiveDate are required' })
    const garnishment = await prisma.garnishment.create({
      data: {
        employeeId,
        garnishmentType,
        orderNumber: orderNumber || null,
        issuingAgency: issuingAgency || null,
        calculationMethod: calculationMethod || 'fixed_amount',
        amount: amount ?? 0,
        maxPercentOfDisposable: maxPercentOfDisposable ?? null,
        priority: priority ?? 1,
        remainingBalance: amount ?? null,
        effectiveDate: new Date(effectiveDate),
      },
    })
    return res.status(201).json(garnishment)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
