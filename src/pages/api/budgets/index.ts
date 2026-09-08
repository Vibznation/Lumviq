import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceFeature } from '../../../lib/entitlements'
import { amountRequiresApproval, requestApproval } from '../../../lib/approvals'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    const periodYear = req.query.periodYear ? Number(req.query.periodYear) : undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const budgets = await prisma.budget.findMany({
      where: { organizationId, ...(periodYear ? { periodYear } : {}) },
      include: { account: true },
      orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }],
    })
    return res.status(200).json(budgets)
  }

  if (req.method === 'POST') {
    const { organizationId, accountId, periodMonth, periodYear, amount } = req.body || {}
    if (!organizationId || !accountId || !periodMonth || !periodYear || amount == null) {
      return res.status(400).json({ error: 'organizationId, accountId, periodMonth, periodYear and amount are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceFeature(res, prisma, organizationId, 'planning.budgets'))) return

    const account = await prisma.account.findUnique({ where: { id: accountId } })
    if (!account || account.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Account does not belong to this organization' })
    }

    const org = await prisma.organization.findUnique({ where: { id: organizationId } })
    if (amountRequiresApproval('budget-change', Number(amount), org?.approvalThresholds as any)) {
      const approval = await prisma.$transaction((tx) =>
        requestApproval(tx, {
          organizationId,
          resourceType: 'budget-change',
          resourceId: `${accountId}:${periodYear}-${periodMonth}`,
          amount,
          payload: { organizationId, accountId, periodMonth, periodYear, amount },
          requestedByUserId: user.id,
          note: `Budget change for ${account.name} (${periodMonth}/${periodYear})`,
        })
      )
      return res.status(202).json({ requiresApproval: true, approval })
    }

    const budget = await prisma.budget.upsert({
      where: { organizationId_accountId_periodMonth_periodYear: { organizationId, accountId, periodMonth, periodYear } },
      update: { amount },
      create: { organizationId, accountId, periodMonth, periodYear, amount },
    })
    return res.status(201).json(budget)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
