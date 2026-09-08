import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const assets = await prisma.fixedAsset.findMany({ where: { organizationId }, include: { depreciationEntries: true }, orderBy: { createdAt: 'desc' } })
    return res.status(200).json(assets)
  }

  if (req.method === 'POST') {
    const { organizationId, name, assetAccountId, depreciationExpenseAccountId, accumulatedDepreciationAccountId, acquisitionDate, cost, salvageValue, usefulLifeMonths, method } = req.body || {}
    if (!organizationId || !name || !assetAccountId || !depreciationExpenseAccountId || !accumulatedDepreciationAccountId || !acquisitionDate || cost == null || !usefulLifeMonths) {
      return res.status(400).json({ error: 'organizationId, name, assetAccountId, depreciationExpenseAccountId, accumulatedDepreciationAccountId, acquisitionDate, cost and usefulLifeMonths are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const asset = await prisma.fixedAsset.create({
      data: {
        organizationId,
        name,
        assetAccountId,
        depreciationExpenseAccountId,
        accumulatedDepreciationAccountId,
        acquisitionDate: new Date(acquisitionDate),
        cost,
        salvageValue: salvageValue ?? 0,
        usefulLifeMonths,
        method: method || 'straight_line',
      },
    })
    return res.status(201).json(asset)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
