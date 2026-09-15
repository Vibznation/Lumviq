import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceFeature } from '../../../../lib/entitlements'
import { onboardContractorWithProvider } from '../../../../lib/payroll-onboarding'
import { PayrollProviderNotConnectedError } from '../../../../lib/payroll-run'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const contractor = await prisma.contractor.findUnique({ where: { id } })
  if (!contractor) return res.status(404).json({ error: 'Contractor not found' })
  if (!(await userHasMembership(user.id, contractor.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceFeature(res, prisma, contractor.organizationId, 'expenses.contractor-tracking'))) return

  try {
    const updated = await prisma.$transaction((tx) => onboardContractorWithProvider(tx, contractor.organizationId, id))
    return res.status(200).json(updated)
  } catch (err: any) {
    if (err instanceof PayrollProviderNotConnectedError) return res.status(409).json({ error: err.message })
    return res.status(400).json({ error: err.message })
  }
}
