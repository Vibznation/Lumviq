import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceFeature } from '../../../lib/entitlements'
import { mileageAmount } from '../../../lib/mileage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const logs = await prisma.mileageLog.findMany({ where: { organizationId }, orderBy: { date: 'desc' } })
    return res.status(200).json(logs)
  }

  if (req.method === 'POST') {
    const { organizationId, date, startLocation, endLocation, purpose, miles, ratePerMile } = req.body || {}
    if (!organizationId || !date || !startLocation || !endLocation || miles == null || ratePerMile == null) {
      return res.status(400).json({ error: 'organizationId, date, startLocation, endLocation, miles and ratePerMile are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceFeature(res, prisma, organizationId, 'expenses.mileage-tracking'))) return
    const milesNum = Number(miles)
    const rateNum = Number(ratePerMile)
    if (!(milesNum > 0) || !(rateNum >= 0)) {
      return res.status(400).json({ error: 'miles must be positive and ratePerMile must be zero or greater' })
    }
    const amount = mileageAmount(milesNum, rateNum)
    const log = await prisma.mileageLog.create({
      data: {
        organizationId,
        userId: user.id,
        date: new Date(date),
        startLocation,
        endLocation,
        purpose: purpose || null,
        miles: milesNum.toString(),
        ratePerMile: rateNum.toString(),
        amount: amount.toString(),
      },
    })
    return res.status(201).json(log)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
