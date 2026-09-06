import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership, userHasPermission } from '../../../lib/authorization'

/**
 * Configurable per-resource-type approval dollar thresholds, stored as a
 * JSON map on Organization.approvalThresholds (e.g. { "bill-payment": 500,
 * "reimbursement": 200 }). src/lib/approvals.ts falls back to the
 * hardcoded APPROVAL_THRESHOLDS default when an organization has not
 * configured a value for a given resource type.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const org = await prisma.organization.findUnique({ where: { id: organizationId } })
    return res.status(200).json(org?.approvalThresholds || {})
  }

  if (req.method === 'PUT') {
    const { organizationId, thresholds } = req.body || {}
    if (!organizationId || typeof thresholds !== 'object') {
      return res.status(400).json({ error: 'organizationId and thresholds are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await userHasPermission(user.id, organizationId, 'manage_organization'))) {
      return res.status(403).json({ error: 'Only an owner or admin can change approval thresholds' })
    }
    const org = await prisma.organization.update({ where: { id: organizationId }, data: { approvalThresholds: thresholds } })
    return res.status(200).json(org.approvalThresholds)
  }

  res.setHeader('Allow', 'GET, PUT')
  return res.status(405).end()
}
