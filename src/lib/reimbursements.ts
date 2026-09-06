/**
 * Domain logic for employee/contractor expense reimbursements. A
 * reimbursement is requested (pending), then approved, then marked paid —
 * only the "paid" transition posts to the ledger (Debit Expense, Credit
 * the payment account).
 */
export async function postReimbursementToLedger(tx: any, reimbursement: any, actorId: string) {
  if (reimbursement.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: reimbursement.journalEntryId }, include: { lines: true } })
  }
  if (!reimbursement.paymentAccountId) {
    throw new Error('A payment account is required before this reimbursement can be paid')
  }

  const idempotencyKey = `reimbursement:${reimbursement.id}:pay`

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: reimbursement.organizationId,
      description: `Reimbursement for ${reimbursement.payeeName}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: [
          { accountId: reimbursement.expenseAccountId, amount: reimbursement.amount, isDebit: true, description: `Reimbursement: ${reimbursement.description || reimbursement.payeeName}` },
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
