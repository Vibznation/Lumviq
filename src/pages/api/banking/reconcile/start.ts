import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceFeature } from '../../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { organizationId, bankAccountId, startDate, endDate, statementEndingBalance } = req.body
  if (!organizationId || !bankAccountId || !startDate || !endDate) return res.status(400).json({ error: 'organizationId, bankAccountId, startDate, endDate required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceFeature(res, prisma, organizationId, 'accounting.bank-reconciliation'))) return
  const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } })
  if (!bankAccount || bankAccount.organizationId !== organizationId) return res.status(400).json({ error: 'Invalid bank account for this organization' })
  const parsedStartDate = new Date(startDate)
  const parsedEndDate = new Date(endDate)
  if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
    return res.status(400).json({ error: 'startDate and endDate must be valid dates' })
  }
  const session = await prisma.reconciliationSession.create({
    data: {
      organizationId,
      bankAccountId,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      statementEndingBalance: statementEndingBalance != null && statementEndingBalance !== '' ? statementEndingBalance.toString() : null,
    },
  })
  return res.status(201).json(session)
}
