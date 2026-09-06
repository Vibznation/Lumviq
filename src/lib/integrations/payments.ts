/**
 * Payment processor interface (e.g. card/ACH processors).
 *
 * NOT IMPLEMENTED: no processor is wired up. Invoices can only be marked
 * paid manually or by importing bank activity — Lumviq does not move
 * money and cannot claim to process a payment without a real, licensed
 * processor adapter registered here.
 */
export interface PaymentIntentResult {
  externalId: string
  status: 'pending' | 'succeeded' | 'failed'
  amount: string
}

export interface PaymentProcessor {
  readonly name: string
  isConfigured(): boolean
  createPaymentIntent(organizationId: string, amount: string, currency: string): Promise<PaymentIntentResult>
  getPaymentStatus(externalId: string): Promise<PaymentIntentResult>
}
