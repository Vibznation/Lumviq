/**
 * Mileage tracking (Lumviq Start and higher). Records business-travel
 * mileage log entries for tax-deduction / reimbursement purposes. This
 * is a directory/log only — Lumviq does not calculate tax deductions or
 * automatically create a Reimbursement; a mileage log can optionally be
 * linked to an existing Reimbursement once one has been created for it.
 * See docs/known-limitations.md.
 */

/** Reimbursable amount for a mileage entry, rounded to cents. */
export function mileageAmount(miles: number, ratePerMile: number): number {
  return Math.round(miles * ratePerMile * 100) / 100
}

export type MileageLogItem = {
  id: string
  date: Date | string
  startLocation: string
  endLocation: string
  purpose?: string | null
  miles: string | number
  amount: string | number
}

/** Formats a set of mileage log entries into line items for a multi-line reimbursement. */
export function buildReimbursementLinesFromMileage(
  logs: MileageLogItem[],
  expenseAccountId: string
) {
  return logs.map((log) => ({
    date: new Date(log.date),
    description: `${Number(log.miles).toFixed(1)} mi: ${log.startLocation} → ${log.endLocation}${log.purpose ? ` (${log.purpose})` : ''}`,
    amount: Number(log.amount).toFixed(2),
    expenseAccountId,
  }))
}

/** Converts multiple un-reimbursed mileage logs into a pending Reimbursement in a transaction. */
export async function convertMileageLogsToReimbursementTx(
  tx: any,
  params: {
    organizationId: string
    actorId: string
    payeeName: string
    expenseAccountId: string
    mileageLogIds: string[]
  }
) {
  const { organizationId, actorId, payeeName, expenseAccountId, mileageLogIds } = params
  if (!mileageLogIds.length) throw new Error('At least one mileage log is required')

  const logs = await tx.mileageLog.findMany({
    where: {
      id: { in: mileageLogIds },
      organizationId,
    },
    orderBy: { date: 'asc' },
  })

  if (logs.length !== mileageLogIds.length) {
    throw new Error('One or more mileage logs were not found or do not belong to this organization')
  }

  const alreadyReimbursed = logs.find((l: any) => l.reimbursementId)
  if (alreadyReimbursed) {
    throw new Error('One or more selected mileage logs are already linked to a reimbursement')
  }

  const totalAmount = logs.reduce((sum: number, l: any) => sum + Number(l.amount), 0)
  const linesData = buildReimbursementLinesFromMileage(logs, expenseAccountId)

  const reimbursement = await tx.reimbursement.create({
    data: {
      organizationId,
      payeeName,
      amount: totalAmount.toFixed(2),
      description: `Mileage reimbursement (${logs.length} trip${logs.length === 1 ? '' : 's'})`,
      expenseAccountId,
      status: 'pending',
      requestedByUserId: actorId,
      lines: {
        create: linesData,
      },
    },
    include: { lines: true },
  })

  await tx.mileageLog.updateMany({
    where: { id: { in: mileageLogIds } },
    data: { reimbursementId: reimbursement.id },
  })

  await tx.auditEvent.create({
    data: {
      organizationId,
      actorId,
      action: 'mileage.convert_to_reimbursement',
      resourceType: 'reimbursement',
      resourceId: reimbursement.id,
      newState: { mileageLogIds, count: logs.length, totalAmount: totalAmount.toFixed(2) },
    },
  })

  return reimbursement
}
