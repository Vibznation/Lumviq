import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../../lib/entitlements'
import { recordTaxPayment } from '../../../../../lib/payroll-tax'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const filing = await prisma.taxFiling.findUnique({ where: { id } })
  if (!filing) return res.status(404).json({ error: 'Tax filing not found' })
  if (!(await userHasMembership(user.id, filing.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceAddOnGroup(res, prisma, filing.organizationId, 'payroll'))) return

  const { paymentAccountId } = req.body || {}
  if (!paymentAccountId) return res.status(400).json({ error: 'paymentAccountId is required' })

  try {
    const updated = await prisma.$transaction((tx) => recordTaxPayment(tx, filing.organizationId, id, paymentAccountId, user.id))
    return res.status(200).json(updated)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
