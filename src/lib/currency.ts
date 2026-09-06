import { toMinorUnits, fromMinorUnits, multiplyMinor } from './money'

/**
 * Multi-currency support: organizations record transactions in a base
 * currency (Organization has no explicit base-currency field yet, so USD
 * is assumed as the implicit base — see docs/known-limitations.md).
 * Exchange rates are manually entered (no live-rate provider is
 * configured) and used only to convert/display amounts; they never alter
 * posted ledger amounts, which always remain in the currency they were
 * posted in.
 */
export function convertUsingRate(amount: string | number, rate: string | number): string {
  const amountMinor = toMinorUnits(amount)
  // Rate itself is not in minor units of a currency, so scale it separately
  // at 6 decimal places to match toMinorUnits' assumed precision.
  const rateMinor = toMinorUnits(rate)
  return fromMinorUnits(multiplyMinor(amountMinor, rateMinor))
}

/** Finds the most recent exchange rate on or before `asOfDate` for a currency pair. */
export async function findApplicableRate(
  tx: any,
  organizationId: string,
  baseCurrency: string,
  quoteCurrency: string,
  asOfDate: Date
) {
  if (baseCurrency === quoteCurrency) return { rate: '1' }
  const rate = await tx.exchangeRate.findFirst({
    where: { organizationId, baseCurrency, quoteCurrency, asOfDate: { lte: asOfDate } },
    orderBy: { asOfDate: 'desc' },
  })
  if (!rate) throw new Error(`No exchange rate found for ${baseCurrency} -> ${quoteCurrency} on or before ${asOfDate.toISOString()}`)
  return rate
}
