import { PlaidBankFeedProvider } from './bank-feed-plaid'

/**
 * Bank feed provider interface (e.g. Plaid-style aggregators).
 */
export interface BankFeedTransaction {
  externalId: string
  accountExternalId: string
  postedDate: string
  amount: string
  description: string
}

export interface BankFeedProvider {
  readonly name: string
  isConfigured(): boolean
  listAccounts(organizationOrToken: string): Promise<Array<{ externalId: string; name: string; mask: string }>>
  listTransactions(
    organizationOrToken: string,
    accountExternalId: string,
    since: Date
  ): Promise<BankFeedTransaction[]>
}

/**
 * In-memory sandbox bank feed provider for local development/testing.
 */
export class SandboxBankFeedProvider implements BankFeedProvider {
  readonly name = 'Sandbox Bank Feed'

  isConfigured(): boolean {
    return true
  }

  async listAccounts(_token: string): Promise<Array<{ externalId: string; name: string; mask: string }>> {
    return [
      { externalId: 'acc_sandbox_checking', name: 'Primary Business Checking', mask: '1234' },
      { externalId: 'acc_sandbox_savings', name: 'Treasury Reserves', mask: '5678' },
    ]
  }

  async listTransactions(
    _token: string,
    accountExternalId: string,
    since: Date
  ): Promise<BankFeedTransaction[]> {
    const today = new Date().toISOString().split('T')[0]
    return [
      {
        externalId: `tx_sandbox_${accountExternalId}_1`,
        accountExternalId,
        postedDate: today,
        amount: '12500.00',
        description: 'Client Wire Transfer - Acme Corp',
      },
      {
        externalId: `tx_sandbox_${accountExternalId}_2`,
        accountExternalId,
        postedDate: today,
        amount: '-1850.00',
        description: 'Office Lease & Workspace Management',
      },
      {
        externalId: `tx_sandbox_${accountExternalId}_3`,
        accountExternalId,
        postedDate: today,
        amount: '-320.45',
        description: 'Cloud Infrastructure Hosting',
      },
    ]
  }
}

let sandboxBankFeedInstance: SandboxBankFeedProvider | null = null

export function getBankFeedProvider(): BankFeedProvider | undefined {
  const mode = process.env.BANK_FEED_PROVIDER_MODE

  if (mode === 'sandbox') {
    if (!sandboxBankFeedInstance) sandboxBankFeedInstance = new SandboxBankFeedProvider()
    return sandboxBankFeedInstance
  }

  const plaid = new PlaidBankFeedProvider()
  if (plaid.isConfigured() || mode === 'plaid') {
    return plaid
  }

  return undefined
}

