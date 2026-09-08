/**
 * Reconciliation of any general-ledger balance-sheet account (AR, AP,
 * credit cards, loans, etc.) against an external statement/subledger
 * figure — distinct from ReconciliationSession, which only covers
 * bank/credit-card accounts fed by imported BankTransaction rows. This
 * works for any Account by matching posted JournalLine entries.
 */

const DEBIT_NORMAL_TYPES = new Set(['asset', 'expense'])

/** Computes an account's signed balance from posted journal lines up to (and including) asOfDate. */
export async function computeAccountBalance(tx: any, accountId: string, asOfDate: Date): Promise<number> {
  const account = await tx.account.findUnique({ where: { id: accountId } })
  if (!account) throw new Error('Account not found')
  const isDebitNormal = DEBIT_NORMAL_TYPES.has(account.type)

  const lines = await tx.journalLine.findMany({
    where: { accountId, journalEntry: { posted: true, postedAt: { lte: asOfDate } } },
  })
  let balance = 0
  for (const line of lines) {
    const amount = Number(line.amount)
    balance += line.isDebit === isDebitNormal ? amount : -amount
  }
  return balance
}

/** Lists posted journal lines for an account not yet cleared on any reconciliation, up to asOfDate. */
export async function listUnclearedLines(tx: any, accountId: string, asOfDate: Date) {
  return tx.journalLine.findMany({
    where: {
      accountId,
      clearedAt: null,
      journalEntry: { posted: true, postedAt: { lte: asOfDate } },
    },
    include: { journalEntry: true },
    orderBy: { journalEntry: { postedAt: 'asc' } },
  })
}

export async function createAccountReconciliation(
  tx: any,
  params: { organizationId: string; accountId: string; periodEndDate: Date; statementBalance: number; reconciledByUserId?: string }
) {
  const glBalance = await computeAccountBalance(tx, params.accountId, params.periodEndDate)
  return tx.accountReconciliation.create({
    data: {
      organizationId: params.organizationId,
      accountId: params.accountId,
      periodEndDate: params.periodEndDate,
      statementBalance: params.statementBalance.toString(),
      glBalance: glBalance.toString(),
      reconciledByUserId: params.reconciledByUserId ?? null,
      status: 'in_progress',
    },
  })
}

/** Marks a set of journal lines as cleared against a reconciliation. */
export async function clearLines(tx: any, reconciliationId: string, journalLineIds: string[]) {
  return tx.journalLine.updateMany({
    where: { id: { in: journalLineIds } },
    data: { accountReconciliationId: reconciliationId, clearedAt: new Date() },
  })
}

export async function unclearLines(tx: any, journalLineIds: string[]) {
  return tx.journalLine.updateMany({
    where: { id: { in: journalLineIds } },
    data: { accountReconciliationId: null, clearedAt: null },
  })
}

/** Sums cleared-line amounts for a reconciliation, signed the same way as computeAccountBalance. */
export async function computeClearedTotal(tx: any, reconciliationId: string): Promise<number> {
  const reconciliation = await tx.accountReconciliation.findUnique({ where: { id: reconciliationId } })
  if (!reconciliation) throw new Error('Reconciliation not found')
  const account = await tx.account.findUnique({ where: { id: reconciliation.accountId } })
  const isDebitNormal = DEBIT_NORMAL_TYPES.has(account.type)
  const lines = await tx.journalLine.findMany({ where: { accountReconciliationId: reconciliationId } })
  let total = 0
  for (const line of lines) {
    const amount = Number(line.amount)
    total += line.isDebit === isDebitNormal ? amount : -amount
  }
  return total
}

/**
 * Completes a reconciliation. Succeeds only if the cleared-line total
 * matches the entered statement balance within a cent — otherwise throws
 * so the caller can show the discrepancy instead of silently closing.
 */
export async function completeReconciliation(tx: any, reconciliationId: string, reconciledByUserId: string) {
  const reconciliation = await tx.accountReconciliation.findUnique({ where: { id: reconciliationId } })
  if (!reconciliation) throw new Error('Reconciliation not found')
  if (reconciliation.status === 'completed') return reconciliation

  const clearedTotal = await computeClearedTotal(tx, reconciliationId)
  const statementBalance = Number(reconciliation.statementBalance)
  const difference = Math.round((clearedTotal - statementBalance) * 100) / 100
  if (Math.abs(difference) > 0.01) {
    throw new Error(`Cleared total (${clearedTotal.toFixed(2)}) does not match statement balance (${statementBalance.toFixed(2)}); difference of ${difference.toFixed(2)}`)
  }

  return tx.accountReconciliation.update({
    where: { id: reconciliationId },
    data: { status: 'completed', completedAt: new Date(), reconciledByUserId },
  })
}
