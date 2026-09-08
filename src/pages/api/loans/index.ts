import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { generateAmortizationSchedule } from '../../../lib/loans'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const loans = await prisma.loan.findMany({ where: { organizationId }, include: { payments: true }, orderBy: { createdAt: 'desc' } })
    return res.status(200).json(loans)
  }

  if (req.method === 'POST') {
    const { organizationId, name, lenderName, liabilityAccountId, interestExpenseAccountId, disbursementAccountId, principal, interestRatePercent, termMonths, startDate } = req.body || {}
    if (!organizationId || !name || !liabilityAccountId || !interestExpenseAccountId || principal == null || interestRatePercent == null || !termMonths || !startDate) {
      return res.status(400).json({ error: 'organizationId, name, liabilityAccountId, interestExpenseAccountId, principal, interestRatePercent, termMonths and startDate are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const loan = await prisma.loan.create({
      data: {
        organizationId,
        name,
        lenderName,
        liabilityAccountId,
        interestExpenseAccountId,
        disbursementAccountId,
        principal,
        interestRatePercent,
        termMonths,
        startDate: new Date(startDate),
      },
    })
    const schedule = generateAmortizationSchedule({
      principal: Number(loan.principal),
      interestRatePercent: Number(loan.interestRatePercent),
      termMonths: loan.termMonths,
      startDate: loan.startDate,
    })
    return res.status(201).json({ ...loan, schedule })
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
