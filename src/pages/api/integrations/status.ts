import type { NextApiRequest, NextApiResponse } from 'next'
import { requireUserFromRequest } from '../../../lib/authorization'
import { isProviderConnected } from '../../../lib/payroll-run'
import { getPaymentProcessor } from '../../../lib/integrations/payments'
import { getBankFeedProvider } from '../../../lib/integrations/bank-feed'
import { getOcrProvider } from '../../../lib/integrations/ocr'
import { getEmailProviderInfo } from '../../../lib/integrations/email'
import { getFxRateProvider } from '../../../lib/integrations/fx'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // Payroll status
  const payrollConnected = isProviderConnected()
  const rawPayrollMode = process.env.PAYROLL_PROVIDER_MODE
  const payrollMode = rawPayrollMode === 'sandbox' ? 'sandbox' : rawPayrollMode === 'check' && payrollConnected ? 'check' : 'none'

  // Payments status
  const paymentProcessor = getPaymentProcessor()
  const paymentsMode = process.env.PAYMENT_PROVIDER_MODE === 'sandbox' ? 'sandbox' : paymentProcessor?.isConfigured() ? 'stripe' : 'none'
  const paymentsName = paymentProcessor?.name || 'Payment Processing'

  // Bank feeds status
  const bankFeed = getBankFeedProvider()
  const bankFeedMode = process.env.BANK_FEED_PROVIDER_MODE === 'sandbox' ? 'sandbox' : bankFeed?.isConfigured() ? 'plaid' : 'none'
  const bankFeedName = bankFeed?.name || 'Bank Feeds'

  // OCR status
  const ocr = getOcrProvider()
  const ocrMode = process.env.OCR_PROVIDER_MODE === 'sandbox' ? 'sandbox' : ocr?.isConfigured() ? 'vision' : 'none'
  const ocrName = ocr?.name || 'OCR Document Extraction'

  // Email status
  const emailInfo = getEmailProviderInfo()

  // FX status
  const fx = getFxRateProvider()
  const fxMode = process.env.FX_PROVIDER_MODE === 'open' ? 'open' : fx?.isConfigured() ? 'sandbox' : 'none'
  const fxName = fx?.name || 'Exchange Rate Sync'

  return res.status(200).json({
    payroll: { mode: payrollMode, connected: payrollConnected },
    payments: { mode: paymentsMode, name: paymentsName, configured: Boolean(paymentProcessor?.isConfigured()) },
    bankFeeds: { mode: bankFeedMode, name: bankFeedName, configured: Boolean(bankFeed?.isConfigured()) },
    ocr: { mode: ocrMode, name: ocrName, configured: Boolean(ocr?.isConfigured()) },
    email: { mode: emailInfo.mode, name: emailInfo.name, configured: emailInfo.configured, fromAddress: emailInfo.fromAddress },
    fx: { mode: fxMode, name: fxName, configured: Boolean(fx?.isConfigured()) },
  })
}
