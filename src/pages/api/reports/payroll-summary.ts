import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Payroll summary report: totals by pay run within an optional date range
 * (gross, employee/employer tax, deductions, garnishments, reimbursements,
 * benefits cost, net pay), plus a payroll-tax-liability reconciliation
 * comparing the Payroll Taxes Payable ledger balance against the sum of
 * still-outstanding TaxFiling amounts synced from the payroll provider.
 * Informational only — Lumviq is not the system of record for tax filings.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined
  const periodFilter: any = {}
  if (startDate) periodFilter.gte = startDate
  if (endDate) periodFilter.lte = endDate

  const payRuns = await prisma.payRun.findMany({
    where: {
      organizationId,
      status: { in: ['completed', 'reversed'] },
      ...(Object.keys(periodFilter).length ? { payPeriodStart: periodFilter } : {}),
    },
    orderBy: { payPeriodStart: 'asc' },
    select: {
      id: true,
      payPeriodStart: true,
      payPeriodEnd: true,
      offCycle: true,
      status: true,
      totalGross: true,
      totalEmployeeTax: true,
      totalEmployerTax: true,
      totalPretaxDeductions: true,
      totalPosttaxDeductions: true,
      totalGarnishments: true,
      totalReimbursements: true,
      totalEmployerBenefitsCost: true,
      totalNetPay: true,
    },
  })

  const totals = payRuns.reduce(
    (acc, r) => {
      acc.totalGross += Number(r.totalGross)
      acc.totalEmployeeTax += Number(r.totalEmployeeTax)
      acc.totalEmployerTax += Number(r.totalEmployerTax)
      acc.totalPretaxDeductions += Number(r.totalPretaxDeductions)
      acc.totalPosttaxDeductions += Number(r.totalPosttaxDeductions)
      acc.totalGarnishments += Number(r.totalGarnishments)
      acc.totalReimbursements += Number(r.totalReimbursements)
      acc.totalEmployerBenefitsCost += Number(r.totalEmployerBenefitsCost)
      acc.totalNetPay += Number(r.totalNetPay)
      return acc
    },
    {
      totalGross: 0,
      totalEmployeeTax: 0,
      totalEmployerTax: 0,
      totalPretaxDeductions: 0,
      totalPosttaxDeductions: 0,
      totalGarnishments: 0,
      totalReimbursements: 0,
      totalEmployerBenefitsCost: 0,
      totalNetPay: 0,
    }
  )

  const [taxLiabilityAccount, pendingFilings] = await Promise.all([
    prisma.account.findFirst({ where: { organizationId, subtype: 'payroll_tax_liability' } }),
    prisma.taxFiling.findMany({ where: { organizationId, status: 'pending', amount: { not: null } } }),
  ])

  let ledgerBalance: number | null = null
  if (taxLiabilityAccount) {
    const lines = await prisma.journalLine.findMany({ where: { accountId: taxLiabilityAccount.id, journalEntry: { posted: true } } })
    ledgerBalance = lines.reduce((sum, l) => sum + (l.isDebit ? -Number(l.amount) : Number(l.amount)), 0)
  }
  const outstandingFilingsTotal = pendingFilings.reduce((sum, f) => sum + Number(f.amount), 0)

  return res.status(200).json({
    payRuns,
    totals,
    taxLiabilityReconciliation: {
      ledgerBalance,
      outstandingFilingsTotal,
      difference: ledgerBalance != null ? Number((ledgerBalance - outstandingFilingsTotal).toFixed(2)) : null,
    },
  })
}
