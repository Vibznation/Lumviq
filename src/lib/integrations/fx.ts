/**
 * FX / Exchange Rate Provider adapter interface and concrete implementations.
 * Provides live and sandbox exchange rate sync for multi-currency transactions.
 */

export type FxRateQuote = {
  baseCurrency: string
  quoteCurrency: string
  rate: string
  asOfDate: Date
}

export interface FxRateProvider {
  readonly name: string
  isConfigured(): boolean
  getLatestRates(baseCurrency: string, targetCurrencies: string[]): Promise<FxRateQuote[]>
}

/**
 * Deterministic Sandbox FX provider for testing & local development.
 * Simulates realistic standard rates relative to USD.
 */
export class SandboxFxProvider implements FxRateProvider {
  readonly name = 'Sandbox FX Provider'

  private readonly sandboxRatesToUsd: Record<string, number> = {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
    CAD: 1.36,
    AUD: 1.52,
    JPY: 154.2,
    CHF: 0.9,
  }

  isConfigured(): boolean {
    return true
  }

  async getLatestRates(baseCurrency: string, targetCurrencies: string[]): Promise<FxRateQuote[]> {
    const baseUsd = this.sandboxRatesToUsd[baseCurrency.toUpperCase()] ?? 1.0
    const now = new Date()

    return targetCurrencies.map((target) => {
      const targetUsd = this.sandboxRatesToUsd[target.toUpperCase()] ?? 1.0
      // Calculate cross-rate: 1 Base = (targetUsd / baseUsd) Quote
      const rateNumber = targetUsd / baseUsd
      return {
        baseCurrency: baseCurrency.toUpperCase(),
        quoteCurrency: target.toUpperCase(),
        rate: rateNumber.toFixed(4),
        asOfDate: now,
      }
    })
  }
}

/**
 * Live Open Exchange Rates / Frankfurter public FX rate provider.
 */
export class OpenRatesFxProvider implements FxRateProvider {
  readonly name = 'Open Rates (Frankfurter / ECB)'

  isConfigured(): boolean {
    return true
  }

  async getLatestRates(baseCurrency: string, targetCurrencies: string[]): Promise<FxRateQuote[]> {
    const base = baseCurrency.toUpperCase()
    const symbols = targetCurrencies.map((c) => c.toUpperCase()).filter((c) => c !== base).join(',')
    if (!symbols) return []

    const url = `https://api.frankfurter.app/latest?from=${base}&to=${symbols}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`FX rate fetch failed with status ${res.status}`)
    }
    const data = await res.json()
    const date = data.date ? new Date(data.date) : new Date()

    const quotes: FxRateQuote[] = []
    for (const [quote, val] of Object.entries(data.rates || {})) {
      quotes.push({
        baseCurrency: base,
        quoteCurrency: quote,
        rate: Number(val).toFixed(4),
        asOfDate: date,
      })
    }
    return quotes
  }
}

/**
 * Factory for FX rate provider.
 * FX_PROVIDER_MODE='open' | 'sandbox' | 'none'
 */
export function getFxRateProvider(): FxRateProvider | null {
  const mode = (process.env.FX_PROVIDER_MODE || 'sandbox').toLowerCase()
  if (mode === 'sandbox') return new SandboxFxProvider()
  if (mode === 'open' || mode === 'frankfurter') return new OpenRatesFxProvider()
  return null
}
