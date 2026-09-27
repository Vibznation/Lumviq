import { describe, it, expect } from 'vitest'
import { SandboxBankFeedProvider, getBankFeedProvider } from '../src/lib/integrations/bank-feed'
import { PlaidBankFeedProvider } from '../src/lib/integrations/bank-feed-plaid'

describe('bank-feed integration', () => {
  it('SandboxBankFeedProvider lists accounts and transactions', async () => {
    const sandbox = new SandboxBankFeedProvider()
    expect(sandbox.isConfigured()).toBe(true)
    expect(sandbox.name).toBe('Sandbox Bank Feed')

    const accounts = await sandbox.listAccounts('org-1')
    expect(accounts).toHaveLength(2)
    expect(accounts[0].externalId).toBe('acc_sandbox_checking')

    const txs = await sandbox.listTransactions('org-1', 'acc_sandbox_checking', new Date())
    expect(txs.length).toBeGreaterThanOrEqual(1)
    expect(txs[0].externalId).toContain('acc_sandbox_checking')
  })

  it('getBankFeedProvider returns sandbox when BANK_FEED_PROVIDER_MODE is sandbox', () => {
    const originalMode = process.env.BANK_FEED_PROVIDER_MODE
    try {
      process.env.BANK_FEED_PROVIDER_MODE = 'sandbox'
      const provider = getBankFeedProvider()
      expect(provider).toBeDefined()
      expect(provider?.name).toBe('Sandbox Bank Feed')
    } finally {
      process.env.BANK_FEED_PROVIDER_MODE = originalMode
    }
  })

  it('PlaidBankFeedProvider reports unconfigured without client credentials', () => {
    const plaid = new PlaidBankFeedProvider('', '')
    expect(plaid.isConfigured()).toBe(false)
    expect(plaid.name).toBe('Plaid')
  })
})
