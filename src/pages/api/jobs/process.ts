import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { processDueJobs } from '../../../lib/jobs'
import { sendWebhookDelivery } from '../../../lib/webhooks'
import { sendEmail } from '../../../lib/integrations/email'
import { runRecurringTemplate, processDueRecurringTemplates } from '../../../lib/recurring'
import { runDueWorkflowRules } from '../../../lib/workflows'
import { requireUserFromRequest } from '../../../lib/authorization'

/**
 * Processes due background jobs (webhook deliveries, outbound emails,
 * recurring template runs, workflow rule evaluation). There is no in-process
 * scheduler — call this endpoint on an interval from an external cron (e.g. a
 * Vercel Cron Job hitting this URL every few minutes) or trigger it manually.
 * See docs/deployment.md for wiring a scheduler.
 *
 * Auth: either a valid JOBS_PROCESS_SECRET bearer token (for unattended
 * cron callers) or any logged-in Lumviq user (for manual/admin triggering).
 * If JOBS_PROCESS_SECRET is not configured, only logged-in users may call
 * this endpoint — it is never left unauthenticated.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  const secretConfigured = Boolean(process.env.JOBS_PROCESS_SECRET)
  const secretMatches = secretConfigured && bearer === process.env.JOBS_PROCESS_SECRET

  if (!secretMatches) {
    const user = await requireUserFromRequest(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
  }

  const results = await processDueJobs({
    'webhook.delivery': async (payload) => {
      await sendWebhookDelivery(prisma, payload)
    },
    'email.send': async (payload) => {
      const result = await sendEmail(payload)
      if (result.status === 'failed') throw new Error(result.error || 'Email send failed')
    },
    'recurring.run': async (payload) => {
      const template = await prisma.recurringTemplate.findUnique({ where: { id: payload.templateId } })
      if (!template || !template.active) return
      await prisma.$transaction((tx) => runRecurringTemplate(tx, template, payload.actorId ?? 'system'))
    },
    'recurring.process_due': async (payload) => {
      await processDueRecurringTemplates(prisma, payload?.organizationId, payload?.actorId ?? 'system')
    },
    'workflow.evaluate': async (payload) => {
      if (payload?.organizationId) {
        await prisma.$transaction((tx) => runDueWorkflowRules(tx, payload.organizationId))
      } else {
        const orgs = await prisma.organization.findMany({ select: { id: true } })
        for (const org of orgs) {
          await prisma.$transaction((tx) => runDueWorkflowRules(tx, org.id))
        }
      }
    },
  })

  return res.status(200).json({ processed: results.length, results })
}
