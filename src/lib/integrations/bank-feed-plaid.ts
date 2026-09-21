import type { BankFeedProvider, BankFeedTransaction } from './bank-feed'

/**
 * Plaid bank feed aggregator adapter.
 * Uses Plaid REST API endpoints (/accounts/get, /transactions/sync).
 *
 * Configured via PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV (sandbox | development | production).
 */
export class PlaidBankFeedProvider implements BankFeedProvider {
  readonly name = 'Plaid'

  constructor(
    private readonly clientId: string = process.env.PLAID_CLIENT_ID || '',
    private readonly secret: string = process.env.PLAID_SECRET || '',
    private readonly env: string = process.env.PLAID_ENV || 'sandbox'
  ) {}

  isConfigured(): boolean {
    return Boolean(this.clientId && this.secret)
  }

  private getBaseUrl(): string {
    switch (this.env) {
      case 'production':
        return 'https://production.plaid.com'
      case 'development':
        return 'https://development.plaid.com'
      default:
        return 'https://sandbox.plaid.com'
    }
  }

  private async request(endpoint: string, body: Record<string, any>): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Plaid is not configured. Missing PLAID_CLIENT_ID or PLAID_SECRET.')
    }

    const res = await fetch(`${this.getBaseUrl()}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId.trim(),
        secret: this.secret.trim(),
        ...body,
      }),
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = json?.error_message || `Plaid API error (${res.status})`
      throw new Error(msg)
    }

    return json
  }

  async listAccounts(accessToken: string): Promise<Array<{ externalId: string; name: string; mask: string }>> {
    const data = await this.request('/accounts/get', {
      access_token: accessToken,
    })

    return (data.accounts || []).map((acc: any) => ({
      externalId: acc.account_id,
      name: acc.name || acc.official_name || 'Bank Account',
      mask: acc.mask || '',
    }))
  }

  async listTransactions(
    accessToken: string,
    accountExternalId: string,
    since: Date
  ): Promise<BankFeedTransaction[]> {
    const startDate = since.toISOString().split('T')[0]
    const endDate = new Date().toISOString().split('T')[0]

    const data = await this.request('/transactions/get', {
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: {
        account_ids: [accountExternalId],
        count: 500,
      },
    })

    return (data.transactions || []).map((tx: any) => ({
      externalId: tx.transaction_id,
      accountExternalId: tx.account_id,
      postedDate: tx.date,
      // Plaid reports positive for outflow (debit/expense) and negative for inflow (credit/deposit).
      // In standard accounting, cash outflow is negative and inflow is positive.
      amount: (-1 * Number(tx.amount)).toFixed(2),
      description: tx.name || tx.merchant_name || 'Transaction',
    }))
  }
}
