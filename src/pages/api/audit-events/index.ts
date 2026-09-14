import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { getOrgEntitlements, hasFeature } from '../../../lib/entitlements'

// Basic audit trail (accounting.audit-trail) is a base feature available on every
// plan, since it's core ledger-integrity data. Unlimited retention + CSV export
// (team.audit-history) is an Enterprise-only enhancement on top of that.
const BASE_EVENT_CAP = 200
const ENTERPRISE_EVENT_CAP = 5000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  const resourceType = req.query.resourceType as string | undefined
  const format = req.query.format as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const entitlements = await getOrgEntitlements(prisma, organizationId)
  const hasFullHistory = hasFeature(entitlements, 'team.audit-history')

  if (format === 'csv' && !hasFullHistory) {
    return res.status(403).json({
      error: 'CSV export requires Enterprise',
      upgradeMessage: 'Unlimited audit history and CSV export require the Enterprise plan. Visit /pricing to upgrade.',
    })
  }

  const events = await prisma.auditEvent.findMany({
    where: { organizationId, ...(resourceType ? { resourceType } : {}) },
    orderBy: { createdAt: 'desc' },
    take: hasFullHistory ? ENTERPRISE_EVENT_CAP : BASE_EVENT_CAP,
  })

  if (format === 'csv') {
    const header = 'id,createdAt,action,resourceType,resourceId'
    const rows = events.map((e) =>
      [e.id, e.createdAt.toISOString(), e.action, e.resourceType, e.resourceId]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv = [header, ...rows].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${organizationId}.csv"`)
    return res.status(200).send(csv)
  }

  return res.status(200).json({ events, cap: hasFullHistory ? ENTERPRISE_EVENT_CAP : BASE_EVENT_CAP, unlimited: hasFullHistory })
}
