import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'
import { calculatePayRun, PayrollProviderNotConnectedError } from '../../../../lib/payroll-run'

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
    const { payRun: updated, warnings } = await prisma.$transaction((tx) => calculatePayRun(tx, id, user.id))
    return res.status(200).json({ payRun: updated, warnings })
  } catch (err: any) {
    if (err instanceof PayrollProviderNotConnectedError) return res.status(409).json({ error: err.message })
    return res.status(400).json({ error: err.message })
  }
}
