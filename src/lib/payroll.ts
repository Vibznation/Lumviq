/**
 * Domain logic for payroll ledger posting only.
 *
 * IMPORTANT SCOPE LIMITATION: Lumviq does not calculate tax withholding,
 * file payroll tax returns, or perform direct deposit. This module only
 * records the accounting impact of a pay run (gross pay expense and the
 * corresponding liability) once a business has determined amounts using
 * a licensed payroll provider or their own calculations. See the Payroll
 * page for the user-facing disclaimer.
 *
 * Posting matrix:
 *   Pay run posted -> Debit Payroll Expense (total gross), Credit Payroll Liabilities
 */

export async function findPayrollAccounts(tx: any, organizationId: string) {
  const expense = await tx.account.findFirst({ where: { organizationId, subtype: 'payroll_expense' } })
  const liability = await tx.account.findFirst({ where: { organizationId, subtype: 'payroll_liability' } })
  if (!expense || !liability) {
    throw new Error('Payroll Expense and Payroll Liabilities accounts must be configured for this organization')
  }
  return { expense, liability }
}

/**
 * Posts a pay run to the ledger. Idempotent: if the pay run already has a
 * journalEntryId, the existing entry is returned unchanged.
 */
export async function postPayRunToLedger(tx: any, payRun: any, actorId: string) {
  if (payRun.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: payRun.journalEntryId }, include: { lines: true } })
  }

  const { expense, liability } = await findPayrollAccounts(tx, payRun.organizationId)
  const idempotencyKey = `pay-run:${payRun.id}:post`

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: payRun.organizationId,
      description: `Pay run ${payRun.payPeriodStart.toISOString().slice(0, 10)} – ${payRun.payPeriodEnd.toISOString().slice(0, 10)}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: [
          { accountId: expense.id, amount: payRun.totalGross, isDebit: true, description: 'Gross payroll expense' },
          { accountId: liability.id, amount: payRun.totalGross, isDebit: false, description: 'Payroll liabilities' },
        ],
      },
    },
    include: { lines: true },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: payRun.organizationId,
      actorId,
      action: 'pay_run.post',
      resourceType: 'pay_run',
      resourceId: payRun.id,
      newState: { journalEntryId: entry.id },
    },
  })

  return entry
}
