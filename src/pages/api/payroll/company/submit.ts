import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'
import { submitCompanyToProvider } from '../../../../lib/payroll-onboarding'
import { PayrollProviderNotConnectedError } from '../../../../lib/payroll-run'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { organizationId } = req.body || {}
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceAddOnGroup(res, prisma, organizationId, 'payroll'))) return

  try {
    const profile = await prisma.$transaction((tx) => submitCompanyToProvider(tx, organizationId))
    const { einEncrypted, ...safe } = profile
    return res.status(200).json(safe)
  } catch (err: any) {
    if (err instanceof PayrollProviderNotConnectedError) return res.status(409).json({ error: err.message })
    return res.status(400).json({ error: err.message })
  }
}
