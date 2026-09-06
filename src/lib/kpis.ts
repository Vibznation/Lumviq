/**
 * Custom KPI evaluation. Each KpiDefinition is a labeled sum/average over
 * a set of account balances (posted journal lines only), signed the same
 * way as src/pages/api/reports/summary.ts (debit-normal accounts positive,
 * credit-normal accounts shown as their natural positive balance).
 */
export async function evaluateKpi(tx: any, kpi: any): Promise<number> {
  if (kpi.accountIds.length === 0) return 0
  const accounts = await tx.account.findMany({ where: { id: { in: kpi.accountIds } } })
  const accountsById = new Map(accounts.map((a: any) => [a.id, a]))

  const lines = await tx.journalLine.findMany({
    where: { accountId: { in: kpi.accountIds }, journalEntry: { posted: true } },
  })

  const balances = new Map<string, number>()
  for (const line of lines) {
    const account: any = accountsById.get(line.accountId)
    if (!account) continue
    const amount = Number(line.amount)
    const isDebitNormal = account.type === 'asset' || account.type === 'expense'
    const signed = line.isDebit === isDebitNormal ? amount : -amount
    balances.set(line.accountId, (balances.get(line.accountId) || 0) + signed)
  }

  const values = kpi.accountIds.map((id: string) => balances.get(id) || 0)
  if (kpi.operation === 'average') {
    return values.reduce((a: number, b: number) => a + b, 0) / values.length
  }
  return values.reduce((a: number, b: number) => a + b, 0)
}
