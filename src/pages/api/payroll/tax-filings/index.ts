import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'
import { syncTaxFilings } from '../../../../lib/payroll-tax'
import { PayrollProviderNotConnectedError } from '../../../../lib/payroll-run'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const filings = await prisma.taxFiling.findMany({ where: { organizationId }, orderBy: { filingPeriodEnd: 'desc' } })
    return res.status(200).json(filings)
  }

  if (req.method === 'POST') {
    const { organizationId } = req.body || {}
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceAddOnGroup(res, prisma, organizationId, 'payroll'))) return
    try {
      const filings = await prisma.$transaction((tx) => syncTaxFilings(tx, organizationId))
      return res.status(200).json(filings)
    } catch (err: any) {
      if (err instanceof PayrollProviderNotConnectedError) return res.status(409).json({ error: err.message })
      return res.status(400).json({ error: err.message })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
