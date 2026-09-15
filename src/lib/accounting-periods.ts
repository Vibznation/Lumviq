/**
 * Closing an AccountingPeriod. Separate from src/lib/close-checklist.ts
 * (which only tracks checklist tasks) — this enforces that a period
 * cannot actually be locked until its checklist is complete, then flips
 * AccountingPeriod.isClosed so src/lib/ledger.ts starts rejecting new
 * postings dated inside it.
 */
import { allItemsComplete } from './close-checklist'

export async function closeAccountingPeriod(
  tx: any,
  params: { accountingPeriodId: string; actorId: string }
) {
  const period = await tx.accountingPeriod.findUnique({
    where: { id: params.accountingPeriodId },
    include: { fiscalYear: true },
  })
  if (!period) throw new Error('Accounting period not found')
  if (period.isClosed) throw new Error('Accounting period is already closed')

  const itemCount = await tx.closeChecklistItem.count({
    where: { accountingPeriodId: params.accountingPeriodId },
  })
  if (itemCount === 0) {
    throw new Error('Create a close checklist for this period before closing it')
  }
  const complete = await allItemsComplete(tx, params.accountingPeriodId)
  if (!complete) {
    throw new Error('All close checklist items must be complete before closing the period')
  }

  const updated = await tx.accountingPeriod.update({
    where: { id: params.accountingPeriodId },
    data: { isClosed: true },
  })
  await tx.auditEvent.create({
    data: {
      organizationId: period.fiscalYear.organizationId,
      actorId: params.actorId,
      action: 'close_accounting_period',
      resourceType: 'accounting_period',
      resourceId: period.id,
      newState: { isClosed: true },
    },
  })
  return updated
}
