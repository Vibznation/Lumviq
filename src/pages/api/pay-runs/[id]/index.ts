import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { addMinor, fromMinorUnits, toMinorUnits } from '../../../../lib/money'

/**
 * GET: fetch a single pay run with its lines.
 * PATCH: enter payroll-provider totals (employee tax withholding per
 * employee line, and the employer's payroll tax expense) on a draft pay
 * run before posting it to the ledger. Lumviq does not calculate these
 * amounts — they come from a licensed payroll provider's report.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const payRun = await prisma.payRun.findUnique({ where: { id }, include: { lines: { include: { employee: true } } } })
  if (!payRun) return res.status(404).json({ error: 'Pay run not found' })
  if (!(await userHasMembership(user.id, payRun.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    return res.status(200).json(payRun)
  }

  if (req.method === 'PATCH') {
    if (payRun.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft pay runs can be updated' })
    }
    const { employerTax, lines } = req.body || {}
    if (!Array.isArray(lines)) {
      return res.status(400).json({ error: 'lines is required (one entry per pay run line with employeeTax)' })
    }

    const byId = new Map(payRun.lines.map((l) => [l.id, l]))
    let totalGrossMinor = 0n
    let totalEmployeeTaxMinor = 0n
    const lineUpdates: { id: string; employeeTax: string; netPay: string }[] = []

    for (const l of lines) {
      const existing = byId.get(l.id)
      if (!existing) return res.status(400).json({ error: 'lines must reference existing pay run lines' })
      const grossMinor = toMinorUnits(existing.grossPay.toString())
      const taxMinor = toMinorUnits(l.employeeTax || '0')
      if (taxMinor < 0n || taxMinor > grossMinor) {
        return res.status(400).json({ error: 'Tax withholding must be between 0 and gross pay for each employee' })
      }
      totalGrossMinor = addMinor(totalGrossMinor, grossMinor)
      totalEmployeeTaxMinor = addMinor(totalEmployeeTaxMinor, taxMinor)
      lineUpdates.push({ id: existing.id, employeeTax: fromMinorUnits(taxMinor), netPay: fromMinorUnits(grossMinor - taxMinor) })
    }

    const employerTaxMinor = toMinorUnits(employerTax || '0')
    const totalNetPayMinor = totalGrossMinor - totalEmployeeTaxMinor

    const updated = await prisma.$transaction(async (tx) => {
      for (const lu of lineUpdates) {
        await tx.payRunLine.update({ where: { id: lu.id }, data: { employeeTax: lu.employeeTax, netPay: lu.netPay } })
      }
      return tx.payRun.update({
        where: { id },
        data: {
          totalEmployeeTax: fromMinorUnits(totalEmployeeTaxMinor),
          totalEmployerTax: fromMinorUnits(employerTaxMinor),
          totalNetPay: fromMinorUnits(totalNetPayMinor),
        },
        include: { lines: { include: { employee: true } } },
      })
    })

    return res.status(200).json(updated)
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).end()
}
