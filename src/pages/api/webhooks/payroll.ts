import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { getPayrollProvider } from '../../../lib/integrations/payroll-sandbox'
import { syncPayRunStatus } from '../../../lib/payroll-run'

/**
 * Inbound webhook receiver for the connected payroll provider. Verifies
 * the signature via the provider adapter's handleWebhook(), records the
 * event for idempotency (a given (provider, externalEventId) pair is
 * processed at most once), then re-syncs the referenced pay run's status
 * — which is also what actually posts the pay run to the ledger, once
 * the provider reports it as paid/completed (see src/lib/payroll-run.ts).
 *
 * Disabled unless a payroll provider is connected (PAYROLL_PROVIDER_MODE
 * unset in production), matching every other payroll surface's honest
 * "not connected" default.
 */
export const config = {
  api: { bodyParser: false },
}

function readRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const provider = getPayrollProvider()
  if (!provider) {
    return res.status(503).json({ error: 'No payroll provider is connected' })
  }

  const rawBody = await readRawBody(req)
  const signatureHeader = (req.headers['x-payroll-signature'] as string | undefined) || undefined

  let event
  try {
    event = provider.handleWebhook(rawBody, signatureHeader)
  } catch (err: any) {
    return res.status(401).json({ error: err.message })
  }

  const existing = await prisma.payrollWebhookEvent.findUnique({
    where: { provider_externalEventId: { provider: provider.name, externalEventId: event.externalEventId } },
  })
  if (existing) {
    // Already processed — acknowledge without reprocessing.
    return res.status(200).json({ received: true, alreadyProcessed: true })
  }

  const payload = event.payload as Record<string, unknown>
  const providerPayrollId = typeof payload.providerPayrollId === 'string' ? payload.providerPayrollId : undefined
  const payRun = providerPayrollId ? await prisma.payRun.findFirst({ where: { providerPayrollId } }) : null

  const webhookEvent = await prisma.payrollWebhookEvent.create({
    data: {
      organizationId: payRun?.organizationId ?? null,
      provider: provider.name,
      externalEventId: event.externalEventId,
      eventType: event.eventType,
      payload: payload as any,
      status: payRun ? 'received' : 'unmatched',
    },
  })

  if (!payRun) {
    return res.status(200).json({ received: true, matched: false })
  }

  try {
    await prisma.$transaction((tx) => syncPayRunStatus(tx, payRun.id, 'payroll-webhook'))
    await prisma.payrollWebhookEvent.update({ where: { id: webhookEvent.id }, data: { status: 'processed', processedAt: new Date() } })
  } catch (err: any) {
    await prisma.payrollWebhookEvent.update({ where: { id: webhookEvent.id }, data: { status: 'error', error: err.message } })
    return res.status(500).json({ error: err.message })
  }

  return res.status(200).json({ received: true, matched: true })
}
