import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceAddOnGroup } from '../../../lib/entitlements'
import { upsertCompanyProfile } from '../../../lib/payroll-onboarding'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const profile = await prisma.payrollCompanyProfile.findUnique({ where: { organizationId } })
    if (!profile) return res.status(200).json(null)
    const { einEncrypted, ...safe } = profile
    return res.status(200).json(safe)
  }

  if (req.method === 'POST') {
    const { organizationId, ...input } = req.body || {}
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceAddOnGroup(res, prisma, organizationId, 'payroll'))) return
    const required = ['legalBusinessName', 'entityType', 'addressLine1', 'city', 'state', 'postalCode', 'signatoryName', 'signatoryTitle', 'contactEmail']
    for (const field of required) {
      if (!input[field]) return res.status(400).json({ error: `${field} is required` })
    }
    try {
      const profile = await prisma.$transaction((tx) => upsertCompanyProfile(tx, organizationId, input))
      const { einEncrypted, ...safe } = profile
      return res.status(200).json(safe)
    } catch (err: any) {
      return res.status(400).json({ error: err.message })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
