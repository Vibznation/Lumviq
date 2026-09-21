import crypto from 'crypto'
import type { PaymentIntentResult, PaymentProcessor } from './payments'

/**
 * Real Stripe payment processor adapter.
 * Communicates with the Stripe REST API directly using fetch so no extra
 * heavy dependencies are needed.
 *
 * Configured via STRIPE_SECRET_KEY (and optionally STRIPE_WEBHOOK_SECRET).
 */
export class StripePaymentProcessor implements PaymentProcessor {
  readonly name = 'Stripe'

  constructor(
    private readonly apiKey: string = process.env.STRIPE_SECRET_KEY || '',
    private readonly webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET || '',
    private readonly baseUrl: string = 'https://api.stripe.com/v1'
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0)
  }

  private async request(endpoint: string, method: 'GET' | 'POST', body?: Record<string, any>): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Stripe is not configured. Missing STRIPE_SECRET_KEY.')
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey.trim()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    let encodedBody: string | undefined
    if (body && method === 'POST') {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object') {
            for (const [subKey, subVal] of Object.entries(value)) {
              params.append(`${key}[${subKey}]`, String(subVal))
            }
          } else {
            params.append(key, String(value))
          }
        }
      }
      encodedBody = params.toString()
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: encodedBody,
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = json?.error?.message || `Stripe API error (${res.status})`
      throw new Error(msg)
    }

    return json
  }

  async createPaymentIntent(
    organizationId: string,
    amount: string,
    currency: string,
    metadata?: Record<string, string>
  ): Promise<PaymentIntentResult & { clientSecret?: string }> {
    // Stripe expects amount in integer cents for USD
    const numAmount = parseFloat(amount)
    const amountInCents = Math.round(numAmount * 100)

    const payload: Record<string, any> = {
      amount: amountInCents,
      currency: currency.toLowerCase(),
      'automatic_payment_methods[enabled]': 'true',
      metadata: {
        organizationId,
        ...metadata,
      },
    }

    const result = await this.request('/payment_intents', 'POST', payload)

    return {
      externalId: result.id,
      status: result.status === 'succeeded' ? 'succeeded' : result.status === 'canceled' ? 'failed' : 'pending',
      amount: (result.amount / 100).toFixed(2),
      clientSecret: result.client_secret,
    }
  }

  async getPaymentStatus(externalId: string): Promise<PaymentIntentResult> {
    const result = await this.request(`/payment_intents/${encodeURIComponent(externalId)}`, 'GET')

    return {
      externalId: result.id,
      status: result.status === 'succeeded' ? 'succeeded' : result.status === 'canceled' ? 'failed' : 'pending',
      amount: (result.amount / 100).toFixed(2),
    }
  }

  verifyWebhookSignature(payload: string | Buffer, signatureHeader: string): boolean {
    if (!this.webhookSecret || !signatureHeader) return false

    try {
      const parts = signatureHeader.split(',')
      const tPart = parts.find((p) => p.startsWith('t='))
      const v1Part = parts.find((p) => p.startsWith('v1='))
      if (!tPart || !v1Part) return false

      const timestamp = tPart.slice(2)
      const expectedSignature = v1Part.slice(3)
      const signedPayload = `${timestamp}.${payload.toString()}`

      const hmac = crypto.createHmac('sha256', this.webhookSecret)
      hmac.update(signedPayload)
      const calculatedSignature = hmac.digest('hex')

      return crypto.timingSafeEqual(
        Buffer.from(calculatedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )
    } catch {
      return false
    }
  }
}
