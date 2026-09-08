/**
 * Period-close checklist: tasks a team must complete before an
 * AccountingPeriod is marked closed (e.g. "Reconcile operating bank
 * account", "Post depreciation", "Review AR aging"). Purely a tracking
 * workflow — it does not itself flip AccountingPeriod.isClosed; a user
 * still closes the period explicitly once all items are done.
 */

export const DEFAULT_CLOSE_CHECKLIST_LABELS = [
  'Reconcile all bank and credit card accounts',
  'Post depreciation for fixed assets',
  'Post loan interest/principal for the period',
  'Review accounts receivable aging',
  'Review accounts payable aging',
  'Confirm all bills and invoices for the period are recorded',
  'Review and post any accruals',
  'Review budget vs. actuals variance',
]

export async function createChecklistForPeriod(tx: any, params: { organizationId: string; accountingPeriodId: string; labels?: string[] }) {
  const labels = params.labels && params.labels.length > 0 ? params.labels : DEFAULT_CLOSE_CHECKLIST_LABELS
  const items = []
  for (const label of labels) {
    items.push(
      await tx.closeChecklistItem.create({
        data: { organizationId: params.organizationId, accountingPeriodId: params.accountingPeriodId, label },
      })
    )
  }
  return items
}

export async function allItemsComplete(tx: any, accountingPeriodId: string): Promise<boolean> {
  const incomplete = await tx.closeChecklistItem.count({
    where: { accountingPeriodId, status: { not: 'complete' } },
  })
  return incomplete === 0
}
