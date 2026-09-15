import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceAddOnGroup } from '../../../lib/entitlements'
import { registerWorkplace } from '../../../lib/payroll-onboarding'
import { PayrollProviderNotConnectedError } from '../../../lib/payroll-run'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const locations = await prisma.location.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
    return res.status(200).json(locations)
  }

  if (req.method === 'POST') {
    const { organizationId, locationId, state, sutaAccountNumber, sutaRate } = req.body || {}
    if (!organizationId || !locationId || !state) return res.status(400).json({ error: 'organizationId, locationId and state are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceAddOnGroup(res, prisma, organizationId, 'payroll'))) return
    try {
      const location = await prisma.$transaction((tx) =>
        registerWorkplace(tx, organizationId, locationId, { state, sutaAccountNumber, sutaRate })
      )
      return res.status(200).json(location)
    } catch (err: any) {
      if (err instanceof PayrollProviderNotConnectedError) return res.status(409).json({ error: err.message })
      return res.status(400).json({ error: err.message })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
