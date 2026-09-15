export function tokens(text: string) {
  return (text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

export function jaccard(a: string, b: string) {
  const A = new Set(tokens(a))
  const B = new Set(tokens(b))
  if (A.size === 0 && B.size === 0) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const union = new Set([...A, ...B]).size
  return union === 0 ? 0 : inter / union
}

export function daysBetween(a?: string | Date, b?: string | Date) {
  if (!a || !b) return 3650
  const da = new Date(a)
  const db = new Date(b)
  const diff = Math.abs(da.getTime() - db.getTime())
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

/** Weighted confidence score (0-1) for a candidate bank-transaction/journal-line match. */
export function scoreMatch(
  txAmount: number,
  txDate: string | Date,
  txDescription: string,
  lineAmount: number,
  lineDate: string | Date | undefined,
  lineDescription: string,
  amountTolerance = 0.1,
  dateTolerance = 7
) {
  const rel = Math.abs(txAmount - lineAmount) / Math.max(Math.abs(txAmount), Math.abs(lineAmount), 0.01)
  const amountScore = Math.max(0, 1 - rel / amountTolerance)
  const days = daysBetween(txDate, lineDate)
  const dateScore = Math.max(0, 1 - days / dateTolerance)
  const descScore = jaccard(txDescription || '', lineDescription || '')
  return amountScore * 0.6 + dateScore * 0.2 + descScore * 0.2
}

/**
 * Prisma `where` clause for candidate journal lines for a reconciliation
 * session's bank account. If the BankAccount is linked to a real
 * chart-of-accounts Account (`BankAccount.accountId`), candidates are
 * scoped to that single account's lines — matching a bank statement
 * against the correct ledger cash account instead of every line in the
 * organization. Falls back to org-wide (all accounts) when no link is
 * set, preserving prior behavior for unlinked bank accounts.
 */
export function journalLineWhereForBankAccount(organizationId: string, linkedAccountId?: string | null) {
  return linkedAccountId
    ? { accountId: linkedAccountId, journalEntry: { organizationId } }
    : { journalEntry: { organizationId } }
}
