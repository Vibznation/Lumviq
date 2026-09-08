import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { postMonthlyDepreciation } from '../../../../lib/fixed-assets'

/** Posts one month of straight-line depreciation for this asset. Body: { periodDate } */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const asset = await prisma.fixedAsset.findUnique({ where: { id } })
  if (!asset) return res.status(404).json({ error: 'Fixed asset not found' })
  if (!(await userHasMembership(user.id, asset.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const { periodDate } = req.body || {}
  if (!periodDate) return res.status(400).json({ error: 'periodDate is required' })

  const entry = await prisma.$transaction((tx) => postMonthlyDepreciation(tx, id, new Date(periodDate), user.id))
  if (!entry) return res.status(200).json({ message: 'Nothing to depreciate for this period (already fully depreciated, disposed, or already posted)' })
  return res.status(201).json(entry)
}
