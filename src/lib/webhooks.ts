import { createHmac, randomBytes } from 'crypto'

/**
 * Outbound webhook subscriptions for the public developer API, per
 * prompt.md's INTEGRATION ARCHITECTURE requirement (webhook validation,
 * retry, health monitoring). No public API exists yet to generate real
 * events from — see docs/known-limitations.md. `dispatchWebhookEvent` logs
 * a WebhookDelivery row and signs the payload, but does not perform a
 * real outbound HTTP request; wiring an actual fetch() call is the
 * remaining step once real event sources exist.
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

/** Records a (not-yet-sent) delivery attempt for an event on every active webhook subscribed to it. */
export async function dispatchWebhookEvent(tx: any, organizationId: string, eventType: string, payload: unknown) {
  const webhooks = await tx.webhook.findMany({
    where: { organizationId, active: true, eventTypes: { has: eventType } },
  })
  const deliveries = []
  for (const webhook of webhooks) {
    deliveries.push(
      await tx.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          eventType,
          payload: payload as any,
          status: 'not_sent', // no outbound HTTP call is performed yet
        },
      })
    )
  }
  return deliveries
}
