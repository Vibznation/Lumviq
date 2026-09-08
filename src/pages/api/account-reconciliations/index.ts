import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { createAccountReconciliation, listUnclearedLines } from '../../../lib/account-reconciliation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    const accountId = req.query.accountId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    if (req.query.uncleared === '1' && accountId && req.query.asOfDate) {
      const lines = await listUnclearedLines(prisma, accountId, new Date(req.query.asOfDate as string))
      return res.status(200).json(lines)
    }

    const reconciliations = await prisma.accountReconciliation.findMany({
      where: { organizationId, ...(accountId ? { accountId } : {}) },
      include: { account: true },
      orderBy: { periodEndDate: 'desc' },
    })
    return res.status(200).json(reconciliations)
  }

  if (req.method === 'POST') {
    const { organizationId, accountId, periodEndDate, statementBalance } = req.body || {}
    if (!organizationId || !accountId || !periodEndDate || statementBalance == null) {
      return res.status(400).json({ error: 'organizationId, accountId, periodEndDate and statementBalance are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const reconciliation = await prisma.$transaction((tx) =>
      createAccountReconciliation(tx, {
        organizationId,
        accountId,
        periodEndDate: new Date(periodEndDate),
        statementBalance: Number(statementBalance),
        reconciledByUserId: user.id,
      })
    )
    return res.status(201).json(reconciliation)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
