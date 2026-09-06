/**
 * Bank feed provider interface (e.g. Plaid-style aggregators).
 *
 * NOT IMPLEMENTED: no provider is wired up. This interface exists so a real
 * adapter can be built against a licensed aggregator without changing any
 * calling code. Until an adapter is registered, bank feeds must remain
 * "Not connected" in the UI — never simulated as live.
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
  listAccounts(organizationId: string): Promise<Array<{ externalId: string; name: string; mask: string }>>
  listTransactions(organizationId: string, accountExternalId: string, since: Date): Promise<BankFeedTransaction[]>
}
