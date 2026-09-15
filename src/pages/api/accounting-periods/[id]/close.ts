import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership, userHasPermission } from '../../../../lib/authorization'
import { closeAccountingPeriod } from '../../../../lib/accounting-periods'
import { enforceFeature } from '../../../../lib/entitlements'

/** Closes an accounting period once its close checklist is fully complete. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const period = await prisma.accountingPeriod.findUnique({ where: { id }, include: { fiscalYear: true } })
  if (!period) return res.status(404).json({ error: 'Accounting period not found' })

  const organizationId = period.fiscalYear.organizationId
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await userHasPermission(user.id, organizationId, 'accounting.close-period'))) {
    return res.status(403).json({ error: 'You do not have permission to close accounting periods' })
  }
  if (!(await enforceFeature(res, prisma, organizationId, 'accounting.closing-periods'))) return

  try {
    const updated = await prisma.$transaction((tx) =>
      closeAccountingPeriod(tx, { accountingPeriodId: id, actorId: user.id })
    )
    return res.status(200).json(updated)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
