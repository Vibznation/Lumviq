import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { addMinor, fromMinorUnits, toMinorUnits } from '../../../lib/money'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const payRuns = await prisma.payRun.findMany({
      where: { organizationId },
      include: { lines: { include: { employee: true } } },
      orderBy: { payPeriodStart: 'desc' },
    })
    return res.status(200).json(payRuns)
  }

  if (req.method === 'POST') {
    const { organizationId, payPeriodStart, payPeriodEnd, lines, employerTax } = req.body || {}
    if (!organizationId || !payPeriodStart || !payPeriodEnd || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'organizationId, payPeriodStart, payPeriodEnd and at least one line are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    for (const l of lines) {
      const employee = await prisma.employee.findUnique({ where: { id: l.employeeId } })
      if (!employee || employee.organizationId !== organizationId) {
        return res.status(400).json({ error: 'Every line must reference an employee in this organization' })
      }
    }

    let totalGrossMinor = 0n
    let totalEmployeeTaxMinor = 0n
    const lineData = lines.map((l: any) => {
      const grossMinor = toMinorUnits(l.grossPay)
      const taxMinor = toMinorUnits(l.employeeTax || '0')
      if (taxMinor < 0n || taxMinor > grossMinor) {
        throw new Error('Tax withholding must be between 0 and gross pay for each employee')
      }
      totalGrossMinor = addMinor(totalGrossMinor, grossMinor)
      totalEmployeeTaxMinor = addMinor(totalEmployeeTaxMinor, taxMinor)
      return {
        employeeId: l.employeeId,
        grossPay: l.grossPay,
        employeeTax: fromMinorUnits(taxMinor),
        netPay: fromMinorUnits(grossMinor - taxMinor),
        description: l.description || null,
      }
    })
    const employerTaxMinor = toMinorUnits(employerTax || '0')
    const totalNetPayMinor = totalGrossMinor - totalEmployeeTaxMinor

    let payRun
    try {
      payRun = await prisma.payRun.create({
        data: {
          organizationId,
          payPeriodStart: new Date(payPeriodStart),
          payPeriodEnd: new Date(payPeriodEnd),
          totalGross: fromMinorUnits(totalGrossMinor),
          totalEmployeeTax: fromMinorUnits(totalEmployeeTaxMinor),
          totalEmployerTax: fromMinorUnits(employerTaxMinor),
          totalNetPay: fromMinorUnits(totalNetPayMinor),
          lines: { create: lineData },
        },
        include: { lines: { include: { employee: true } } },
      })
    } catch (err: any) {
      return res.status(400).json({ error: err.message })
    }
    return res.status(201).json(payRun)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
