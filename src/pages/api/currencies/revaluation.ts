import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceFeature } from '../../../lib/entitlements'
import { computeUnrealizedFxBalances } from '../../../lib/fx-revaluation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { organizationId, baseCurrency = 'USD', currentRates = {} } = req.body || {}
  if (!organizationId) return res.status(400).json({ error: 'organizationId required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceFeature(res, prisma, organizationId, 'settings.currencies'))) return

  try {
    const summary = await computeUnrealizedFxBalances(prisma, {
      organizationId,
      baseCurrency,
      currentRates,
    })
    return res.status(200).json(summary)
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to compute FX revaluation' })
  }
}
