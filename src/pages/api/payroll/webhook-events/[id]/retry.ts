import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../../lib/entitlements'
import { syncPayRunStatus } from '../../../../../lib/payroll-run'

/**
 * Manually reprocesses a previously-errored or unmatched payroll webhook
 * event. Safe to call repeatedly: syncPayRunStatus is idempotent, and
 * this only re-runs the same processing the webhook receiver already
 * attempted. See src/pages/api/payroll/webhook-events.ts for why this
 * exists alongside the provider's own automatic retry-on-non-2xx
 * behavior.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const event = await prisma.payrollWebhookEvent.findUnique({ where: { id } })
  if (!event || !event.organizationId) return res.status(404).json({ error: 'Webhook event not found' })
  if (!(await userHasMembership(user.id, event.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceAddOnGroup(res, prisma, event.organizationId, 'payroll'))) return

  const payload = event.payload as Record<string, unknown>
  const providerPayrollId = typeof payload.providerPayrollId === 'string' ? payload.providerPayrollId : undefined
  const payRun = providerPayrollId ? await prisma.payRun.findFirst({ where: { providerPayrollId } }) : null
  if (!payRun) {
    return res.status(409).json({ error: 'No matching pay run found for this event; it cannot be retried' })
  }

  try {
    await prisma.$transaction((tx) => syncPayRunStatus(tx, payRun.id, 'payroll-webhook-retry'))
    const updated = await prisma.payrollWebhookEvent.update({
      where: { id },
      data: { status: 'processed', processedAt: new Date(), error: null },
    })
    return res.status(200).json(updated)
  } catch (err: any) {
    const updated = await prisma.payrollWebhookEvent.update({ where: { id }, data: { status: 'error', error: err.message } })
    return res.status(500).json({ error: err.message, event: updated })
  }
}
