import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'
import { reversePayRun } from '../../../../lib/payroll-run'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const payRun = await prisma.payRun.findUnique({ where: { id } })
  if (!payRun) return res.status(404).json({ error: 'Pay run not found' })
  if (!(await userHasMembership(user.id, payRun.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceAddOnGroup(res, prisma, payRun.organizationId, 'payroll'))) return

  try {
    const reversal = await prisma.$transaction((tx) => reversePayRun(tx, id, user.id))
    return res.status(201).json(reversal)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
