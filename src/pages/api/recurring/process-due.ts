import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceFeature } from '../../../lib/entitlements'
import { processDueRecurringTemplates } from '../../../lib/recurring'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { organizationId } = req.body || {}
  if (!organizationId) return res.status(400).json({ error: 'organizationId required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceFeature(res, prisma, organizationId, 'sales.recurring-invoices'))) return

  try {
    const results = await processDueRecurringTemplates(prisma, organizationId, user.id)
    return res.status(200).json({
      generatedCount: results.filter((r) => !r.error).length,
      errorsCount: results.filter((r) => r.error).length,
      results,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to process recurring templates' })
  }
}
