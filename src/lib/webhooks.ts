import { createHmac, randomBytes } from 'crypto'
import { enqueueJob } from './jobs'

/**
 * Outbound webhook subscriptions for the public developer API, per
 * prompt.md's INTEGRATION ARCHITECTURE requirement (webhook validation,
 * retry, health monitoring). `dispatchWebhookEvent` creates a
 * WebhookDelivery row per subscribed webhook and enqueues a
 * `webhook.delivery` background job for each — the job (processed by
 * POST /api/jobs/process, see src/lib/jobs.ts) performs the real signed
 * HTTP POST with automatic retry/backoff on failure.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex')
}

/** Computes an HMAC-SHA256 signature for a webhook payload, the same scheme a receiver would verify against. */
export function signPayload(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export async function createWebhook(tx: any, params: { organizationId: string; url: string; eventTypes: string[] }) {
  return tx.webhook.create({
    data: {
      organizationId: params.organizationId,
      url: params.url,
      secret: generateWebhookSecret(),
      eventTypes: params.eventTypes,
    },
  })
}

/** Creates a delivery attempt for an event on every active webhook subscribed to it, and enqueues the real send. */
export async function dispatchWebhookEvent(tx: any, organizationId: string, eventType: string, payload: unknown) {
  const webhooks = await tx.webhook.findMany({
    where: { organizationId, active: true, eventTypes: { has: eventType } },
  })
  const deliveries = []
  for (const webhook of webhooks) {
    const delivery = await tx.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        eventType,
        payload: payload as any,
        status: 'pending',
      },
    })
    await enqueueJob(tx, {
      organizationId,
      type: 'webhook.delivery',
      payload: { deliveryId: delivery.id, webhookId: webhook.id, url: webhook.url, secret: webhook.secret, eventType, body: payload },
    })
    deliveries.push(delivery)
  }
  return deliveries
}

/**
 * Performs the actual signed HTTP POST for one delivery. Called by the
 * `webhook.delivery` job handler in /api/jobs/process — throwing here
 * causes the job queue to retry with backoff.
 */
export async function sendWebhookDelivery(
  prisma: any,
  params: { deliveryId: string; url: string; secret: string; eventType: string; body: unknown }
) {
  const payloadString = JSON.stringify({ eventType: params.eventType, data: params.body })
  const signature = signPayload(params.secret, payloadString)
  let responseCode: number | null = null
  try {
    const res = await fetch(params.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lumviq-Signature': signature,
        'X-Lumviq-Event': params.eventType,
      },
      body: payloadString,
    })
    responseCode = res.status
    if (!res.ok) throw new Error(`Webhook endpoint responded with HTTP ${res.status}`)
    await prisma.webhookDelivery.update({
      where: { id: params.deliveryId },
      data: { status: 'delivered', responseCode },
    })
  } catch (err: any) {
    await prisma.webhookDelivery.update({
      where: { id: params.deliveryId },
      data: { status: 'failed', responseCode },
    })
    throw err
  }
}

