/**
 * Fixed asset register and straight-line depreciation. Other methods
 * (declining balance, units-of-production, etc.) are not implemented —
 * see docs/known-limitations.md.
 *
 * Posting matrix:
 *   Monthly depreciation -> Debit Depreciation Expense, Credit Accumulated Depreciation
 */

/** Monthly straight-line depreciation amount: (cost - salvage) / usefulLifeMonths, rounded to cents. */
export function monthlyDepreciationAmount(asset: { cost: number; salvageValue: number; usefulLifeMonths: number }): number {
  if (asset.usefulLifeMonths <= 0) return 0
  const amount = (asset.cost - asset.salvageValue) / asset.usefulLifeMonths
  return Math.round(amount * 100) / 100
}

/**
 * Posts one month of depreciation for an asset as of `periodDate`.
 * Idempotent per (fixedAssetId, periodDate) — returns the existing entry
 * if already posted. Stops (posts nothing, returns null) once accumulated
 * depreciation would exceed cost - salvageValue, or if the asset is disposed.
 */
export async function postMonthlyDepreciation(tx: any, fixedAssetId: string, periodDate: Date, actorId: string) {
  const asset = await tx.fixedAsset.findUnique({ where: { id: fixedAssetId } })
  if (!asset) throw new Error('Fixed asset not found')
  if (asset.disposedAt) return null

  const existing = await tx.depreciationEntry.findUnique({
    where: { fixedAssetId_periodDate: { fixedAssetId, periodDate } },
  })
  if (existing) return existing

  const priorEntries = await tx.depreciationEntry.findMany({ where: { fixedAssetId } })
  const accumulated = priorEntries.reduce((sum: number, e: any) => sum + Number(e.amount), 0)
  const depreciableBase = Number(asset.cost) - Number(asset.salvageValue)
  const remaining = Math.round((depreciableBase - accumulated) * 100) / 100
  if (remaining <= 0) return null

  const monthly = monthlyDepreciationAmount({
    cost: Number(asset.cost),
    salvageValue: Number(asset.salvageValue),
    usefulLifeMonths: asset.usefulLifeMonths,
  })
  const amount = Math.min(monthly, remaining)
  if (amount <= 0) return null

  const idempotencyKey = `fixed-asset:${fixedAssetId}:depreciation:${periodDate.toISOString().slice(0, 10)}`
  const entry = await tx.journalEntry.create({
    data: {
      organizationId: asset.organizationId,
      description: `Depreciation - ${asset.name}`,
      posted: true,
      postedAt: periodDate,
      idempotencyKey,
      lines: {
        create: [
          { accountId: asset.depreciationExpenseAccountId, amount: amount.toString(), isDebit: true, description: `Depreciation - ${asset.name}` },
          { accountId: asset.accumulatedDepreciationAccountId, amount: amount.toString(), isDebit: false, description: `Depreciation - ${asset.name}` },
        ],
      },
    },
  })

  await tx.auditEvent.create({
    data: { organizationId: asset.organizationId, actorId, action: 'fixed-asset.depreciate', resourceType: 'fixed_asset', resourceId: asset.id, newState: { journalEntryId: entry.id, amount } },
  })

  return tx.depreciationEntry.create({
    data: { fixedAssetId, periodDate, amount: amount.toString(), journalEntryId: entry.id },
  })
}
