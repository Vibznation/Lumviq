/**
 * Domain logic for employee/contractor expense reimbursements. A
 * reimbursement is requested (pending), then approved, then marked paid —
 * only the "paid" transition posts to the ledger (Debit Expense, Credit
 * the payment account). When ReimbursementLine rows exist (multi-line
 * expense report), each line posts to its own expense account; otherwise
 * the reimbursement's single expenseAccountId/amount is used.
 */
export async function postReimbursementToLedger(tx: any, reimbursement: any, actorId: string) {
  if (reimbursement.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: reimbursement.journalEntryId }, include: { lines: true } })
  }
  if (!reimbursement.paymentAccountId) {
    throw new Error('A payment account is required before this reimbursement can be paid')
  }

  const lines = reimbursement.lines && reimbursement.lines.length > 0 ? reimbursement.lines : null
  const idempotencyKey = `reimbursement:${reimbursement.id}:pay`

  const debitLines = lines
    ? lines.map((l: any) => ({ accountId: l.expenseAccountId, amount: l.amount, isDebit: true, description: `Reimbursement: ${l.description}` }))
    : [{ accountId: reimbursement.expenseAccountId, amount: reimbursement.amount, isDebit: true, description: `Reimbursement: ${reimbursement.description || reimbursement.payeeName}` }]

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: reimbursement.organizationId,
      description: `Reimbursement for ${reimbursement.payeeName}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: [
          ...debitLines,
          { accountId: reimbursement.paymentAccountId, amount: reimbursement.amount, isDebit: false, description: `Reimbursement: ${reimbursement.description || reimbursement.payeeName}` },
        ],
      },
    },
    include: { lines: true },
  })

  await tx.reimbursement.update({ where: { id: reimbursement.id }, data: { status: 'paid', journalEntryId: entry.id } })

  await tx.auditEvent.create({
    data: {
      organizationId: reimbursement.organizationId,
      actorId,
      action: 'reimbursement.pay',
      resourceType: 'reimbursement',
      resourceId: reimbursement.id,
      newState: { journalEntryId: entry.id },
    },
  })

  return entry
}

/** Adds an expense line to a reimbursement and recomputes its total amount as the sum of all lines. */
export async function addReimbursementLine(
  tx: any,
  reimbursementId: string,
  line: { date: Date; description: string; amount: string; expenseAccountId: string; documentId?: string | null }
) {
  const reimbursement = await tx.reimbursement.findUnique({ where: { id: reimbursementId } })
  if (!reimbursement) throw new Error('Reimbursement not found')
  if (reimbursement.status === 'paid') throw new Error('Cannot add lines to a reimbursement that has already been paid')

  await tx.reimbursementLine.create({
    data: {
      reimbursementId,
      date: line.date,
      description: line.description,
      amount: line.amount,
      expenseAccountId: line.expenseAccountId,
      documentId: line.documentId || null,
    },
  })

  const allLines = await tx.reimbursementLine.findMany({ where: { reimbursementId } })
  const total = allLines.reduce((sum: number, l: any) => sum + Number(l.amount), 0)
  return tx.reimbursement.update({ where: { id: reimbursementId }, data: { amount: total.toString() }, include: { lines: true } })
}

