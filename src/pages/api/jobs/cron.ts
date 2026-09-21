import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { processDueJobs } from '../../../lib/jobs'
import { sendWebhookDelivery } from '../../../lib/webhooks'
import { sendEmail } from '../../../lib/integrations/email'
import { runRecurringTemplate } from '../../../lib/recurring'
import { runDueWorkflowRules } from '../../../lib/workflows'

/**
 * Standard Vercel Cron handler (GET /api/jobs/cron).
 * Secures requests via CRON_SECRET or JOBS_PROCESS_SECRET.
 * Executes due background jobs, recurring billing templates, and workflow automation rules.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).end()
  }

  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  const cronSecretHeader = req.headers['x-cron-secret'] as string | undefined

  const expectedSecret = process.env.CRON_SECRET || process.env.JOBS_PROCESS_SECRET
  const isAuthorized = expectedSecret
    ? bearer === expectedSecret || cronSecretHeader === expectedSecret
    : process.env.NODE_ENV !== 'production'

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized cron trigger' })
  }

  try {
    // 1. Process due jobs
    const jobResults = await processDueJobs({
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
    })

    // 2. Evaluate workflow rules for all active organizations
    const orgs = await prisma.organization.findMany({ select: { id: true } })
    const workflowSummaries = []
    for (const org of orgs) {
      try {
        const summary = await prisma.$transaction(async (tx) => {
          return runDueWorkflowRules(tx, org.id)
        })
        if (summary.length > 0) {
          workflowSummaries.push({ organizationId: org.id, rules: summary })
        }
      } catch (wfErr) {
        // Log individual org error and continue
        console.error(`Cron: workflow run failed for org ${org.id}:`, wfErr)
      }
    }

    return res.status(200).json({
      success: true,
      jobsProcessed: jobResults.length,
      jobResults,
      workflowsEvaluated: workflowSummaries.length,
      workflowSummaries,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Cron execution failed' })
  }
}
