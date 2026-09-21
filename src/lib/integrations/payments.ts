import { StripePaymentProcessor } from './payments-stripe'

/**
 * Payment processor interface (e.g. card/ACH processors).
 */
export interface PaymentIntentResult {
  externalId: string
  status: 'pending' | 'succeeded' | 'failed'
  amount: string
  clientSecret?: string
}

export interface PaymentProcessor {
  readonly name: string
  isConfigured(): boolean
  createPaymentIntent(
    organizationId: string,
    amount: string,
    currency: string,
    metadata?: Record<string, string>
  ): Promise<PaymentIntentResult>
  getPaymentStatus(externalId: string): Promise<PaymentIntentResult>
  verifyWebhookSignature?(payload: string | Buffer, signatureHeader: string): boolean
}

/**
 * In-memory sandbox payment processor for local development and test runs.
 */
export class SandboxPaymentProcessor implements PaymentProcessor {
  readonly name = 'Sandbox Payments'
  private intents = new Map<string, PaymentIntentResult>()

  isConfigured(): boolean {
    return true
  }

  async createPaymentIntent(
    _organizationId: string,
    amount: string,
    _currency: string,
    _metadata?: Record<string, string>
  ): Promise<PaymentIntentResult> {
    const externalId = `pi_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const result: PaymentIntentResult = {
      externalId,
      status: 'succeeded',
      amount,
      clientSecret: `${externalId}_secret_sandbox`,
    }
    this.intents.set(externalId, result)
    return result
  }

  async getPaymentStatus(externalId: string): Promise<PaymentIntentResult> {
    const existing = this.intents.get(externalId)
    if (existing) return existing
    return {
      externalId,
      status: 'succeeded',
      amount: '0.00',
    }
  }

  verifyWebhookSignature(_payload: string | Buffer, signatureHeader: string): boolean {
    return Boolean(signatureHeader && signatureHeader.length > 0)
  }
}

let sandboxInstance: SandboxPaymentProcessor | null = null

export function getPaymentProcessor(): PaymentProcessor | undefined {
  const mode = process.env.PAYMENT_PROVIDER_MODE

  if (mode === 'sandbox') {
    if (!sandboxInstance) sandboxInstance = new SandboxPaymentProcessor()
    return sandboxInstance
  }

  const stripe = new StripePaymentProcessor()
  if (stripe.isConfigured() || mode === 'stripe') {
    return stripe
  }

  return undefined
}

