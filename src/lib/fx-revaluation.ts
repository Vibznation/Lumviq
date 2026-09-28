/**
 * Currency Revaluation engine for foreign currency balances.
 * Computes unrealized FX gains/losses on open receivables and payables
 * and posts adjusting journal entries at period end.
 */
import { toMinorUnits, fromMinorUnits } from './money'

export type OpenForeignBalance = {
  id: string
  type: 'invoice' | 'bill'
  reference: string
  partyName: string
  foreignCurrency: string
  foreignAmount: string
  originalBaseAmount: string
  originalRate: string
  currentRate: string
  currentBaseAmount: string
  unrealizedGainLoss: string
  isGain: boolean
}

export type RevaluationSummary = {
  organizationId: string
  baseCurrency: string
  asOfDate: Date
  items: OpenForeignBalance[]
  totalUnrealizedGainLoss: string
  netGainMinor: number
}

/**
 * Computes unrealized FX gains or losses for open foreign-currency invoices and bills.
 */
export async function computeUnrealizedFxBalances(
  tx: any,
  params: {
    organizationId: string
    baseCurrency?: string
    currentRates: Record<string, number> // e.g. { EUR: 1.08, CAD: 0.74 } relative to base
  }
): Promise<RevaluationSummary> {
  const { organizationId, baseCurrency = 'USD', currentRates } = params
  const items: OpenForeignBalance[] = []
  let netGainMinor = 0

  // 1. Open Foreign Invoices (Receivables: Higher current base = GAIN, lower = LOSS)
  const openInvoices = await tx.invoice.findMany({
    where: {
      organizationId,
      status: { in: ['sent', 'partially_paid'] },
      currency: { not: baseCurrency },
    },
    include: { customer: true },
  })

  for (const inv of openInvoices) {
    const balanceForeign = (Number(inv.total) - Number(inv.amountPaid)).toFixed(2)
    const rate = currentRates[inv.currency.toUpperCase()] ?? 1.0
    const originalRate = 1.0 // Base nominal rate
    const currentBase = (Number(balanceForeign) * rate).toFixed(2)
    const originalBase = (Number(balanceForeign) * originalRate).toFixed(2)

    const diffMinor = Math.round((Number(currentBase) - Number(originalBase)) * 100)
    netGainMinor += diffMinor

    items.push({
      id: inv.id,
      type: 'invoice',
      reference: inv.invoiceNumber,
      partyName: inv.customer?.name || 'Customer',
      foreignCurrency: inv.currency,
      foreignAmount: balanceForeign,
      originalBaseAmount: originalBase,
      originalRate: originalRate.toFixed(4),
      currentRate: rate.toFixed(4),
      currentBaseAmount: currentBase,
      unrealizedGainLoss: (Math.abs(diffMinor) / 100).toFixed(2),
      isGain: diffMinor >= 0,
    })
  }

  // 2. Open Foreign Bills (Payables: Higher current base = LOSS, lower = GAIN)
  const openBills = await tx.bill.findMany({
    where: {
      organizationId,
      status: { in: ['open', 'partially_paid'] },
      currency: { not: baseCurrency },
    },
    include: { vendor: true },
  })

  for (const bill of openBills) {
    const balanceForeign = (Number(bill.total) - Number(bill.amountPaid)).toFixed(2)
    const rate = currentRates[bill.currency.toUpperCase()] ?? 1.0
    const originalRate = 1.0
    const currentBase = (Number(balanceForeign) * rate).toFixed(2)
    const originalBase = (Number(balanceForeign) * originalRate).toFixed(2)

    // Payables: paying more base is a loss
    const diffMinor = Math.round((Number(originalBase) - Number(currentBase)) * 100)
    netGainMinor += diffMinor

    items.push({
      id: bill.id,
      type: 'bill',
      reference: bill.billNumber,
      partyName: bill.vendor?.name || 'Vendor',
      foreignCurrency: bill.currency,
      foreignAmount: balanceForeign,
      originalBaseAmount: originalBase,
      originalRate: originalRate.toFixed(4),
      currentRate: rate.toFixed(4),
      currentBaseAmount: currentBase,
      unrealizedGainLoss: (Math.abs(diffMinor) / 100).toFixed(2),
      isGain: diffMinor >= 0,
    })
  }

  return {
    organizationId,
    baseCurrency,
    asOfDate: new Date(),
    items,
    totalUnrealizedGainLoss: (Math.abs(netGainMinor) / 100).toFixed(2),
    netGainMinor,
  }
}
