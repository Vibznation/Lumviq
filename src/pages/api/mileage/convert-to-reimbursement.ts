import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceFeature } from '../../../lib/entitlements'
import { convertMileageLogsToReimbursementTx } from '../../../lib/mileage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { organizationId, payeeName, expenseAccountId, mileageLogIds } = req.body || {}
  if (!organizationId || !expenseAccountId || !Array.isArray(mileageLogIds) || mileageLogIds.length === 0) {
    return res.status(400).json({ error: 'organizationId, expenseAccountId, and a non-empty mileageLogIds array are required' })
  }

  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceFeature(res, prisma, organizationId, 'expenses.expense-reimbursements'))) return

  const account = await prisma.account.findUnique({ where: { id: expenseAccountId } })
  if (!account || account.organizationId !== organizationId) {
    return res.status(400).json({ error: 'Expense account does not belong to this organization' })
  }

  try {
    const reimbursement = await prisma.$transaction(async (tx: any) => {
      return convertMileageLogsToReimbursementTx(tx, {
        organizationId,
        actorId: user.id,
        payeeName: payeeName?.trim() || user.name || user.email || 'Employee',
        expenseAccountId,
        mileageLogIds,
      })
    })

    return res.status(201).json({ reimbursement })
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Could not convert mileage logs to reimbursement' })
  }
}
