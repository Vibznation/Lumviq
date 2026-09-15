import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceAddOnGroup } from '../../../lib/entitlements'

/**
 * Lists inbound payroll-provider webhook events for the organization,
 * most recent first. Used by the Payroll → Reports tab to surface any
 * event that failed automatic processing (status 'error') so it can be
 * manually retried via POST /api/payroll/webhook-events/[id]/retry.
 *
 * Primary retry mechanism: this endpoint returns a non-2xx status on
 * failure (see src/pages/api/webhooks/payroll.ts), which every major
 * webhook sender (including Check/Gusto-style providers) treats as a
 * signal to automatically retry delivery with backoff. Processing is
 * idempotent (unique [provider, externalEventId]), so provider-side
 * retries are always safe. This manual retry exists as a second line of
 * defense for the rare case where the provider's own retry window has
 * elapsed before the underlying issue (e.g. a transient DB outage) was
 * fixed.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).end()

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceAddOnGroup(res, prisma, organizationId, 'payroll'))) return

  const events = await prisma.payrollWebhookEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return res.status(200).json(events)
}
