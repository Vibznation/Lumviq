import { describe, it, expect, vi } from 'vitest'
import { SandboxPaymentProcessor, getPaymentProcessor } from '../src/lib/integrations/payments'
import { StripePaymentProcessor } from '../src/lib/integrations/payments-stripe'

describe('payments integration', () => {
  it('SandboxPaymentProcessor creates and verifies payment intents', async () => {
    const sandbox = new SandboxPaymentProcessor()
    expect(sandbox.isConfigured()).toBe(true)
    expect(sandbox.name).toBe('Sandbox Payments')

    const intent = await sandbox.createPaymentIntent('org-123', '250.00', 'USD', { invoiceNumber: 'INV-001' })
    expect(intent.status).toBe('succeeded')
    expect(intent.amount).toBe('250.00')
    expect(intent.externalId).toMatch(/^pi_sandbox_/)
    expect(intent.clientSecret).toBeDefined()

    const status = await sandbox.getPaymentStatus(intent.externalId)
    expect(status.status).toBe('succeeded')
    expect(status.amount).toBe('250.00')

    expect(sandbox.verifyWebhookSignature('payload', 'sig_123')).toBe(true)
    expect(sandbox.verifyWebhookSignature('payload', '')).toBe(false)
  })

  it('getPaymentProcessor returns sandbox when PAYMENT_PROVIDER_MODE is sandbox', () => {
    const originalMode = process.env.PAYMENT_PROVIDER_MODE
    try {
      process.env.PAYMENT_PROVIDER_MODE = 'sandbox'
      const proc = getPaymentProcessor()
      expect(proc).toBeDefined()
      expect(proc?.name).toBe('Sandbox Payments')
    } finally {
      process.env.PAYMENT_PROVIDER_MODE = originalMode
    }
  })

  it('StripePaymentProcessor reports unconfigured when no API key provided', () => {
    const stripe = new StripePaymentProcessor('', '')
    expect(stripe.isConfigured()).toBe(false)
    expect(stripe.name).toBe('Stripe')
  })

  it('StripePaymentProcessor validates webhook signature HMAC', () => {
    const secret = 'whsec_test_secret_12345'
    const stripe = new StripePaymentProcessor('sk_test_key', secret)
    const payload = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' })
    const timestamp = Math.floor(Date.now() / 1000).toString()

    const crypto = require('crypto')
    const signedPayload = `${timestamp}.${payload}`
    const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')

    const validHeader = `t=${timestamp},v1=${expectedSig}`
    expect(stripe.verifyWebhookSignature(payload, validHeader)).toBe(true)

    const invalidHeader = `t=${timestamp},v1=bad_signature`
    expect(stripe.verifyWebhookSignature(payload, invalidHeader)).toBe(false)
  })
})
