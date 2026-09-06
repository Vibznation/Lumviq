/**
 * Nonprofit fund accounting: Funds group restricted/unrestricted money,
 * Grants track award/spend against a fund, Programs group activity for
 * functional-expense reporting. This mirrors prompt.md's NONPROFIT AND
 * GRANT ACCOUNTING requirement that nonprofit accounting be first-class,
 * not an afterthought.
 *
 * Funds/grants/programs are informational tags right now: creating a
 * journal entry does not yet require or enforce a fund/program selection,
 * and there is no dedicated statement-of-activities-by-fund report yet —
 * see docs/known-limitations.md. Grant `amountSpent` must be updated
 * manually via recordGrantSpend; it is not derived automatically from the
 * ledger.
 */
export async function createFund(
  tx: any,
  params: { organizationId: string; name: string; type?: 'restricted' | 'unrestricted'; description?: string | null }
) {
  return tx.fund.create({
    data: {
      organizationId: params.organizationId,
      name: params.name,
      type: params.type ?? 'unrestricted',
      description: params.description ?? null,
    },
  })
}

export async function createGrant(
  tx: any,
  params: {
    organizationId: string
    fundId?: string | null
    name: string
    grantorName: string
    totalAwarded: string
    startDate: string | Date
    endDate?: string | Date | null
  }
) {
  return tx.grant.create({
    data: {
      organizationId: params.organizationId,
      fundId: params.fundId ?? null,
      name: params.name,
      grantorName: params.grantorName,
      totalAwarded: params.totalAwarded,
      startDate: new Date(params.startDate),
      endDate: params.endDate ? new Date(params.endDate) : null,
    },
  })
}

/** Records spend against a grant's award, rejecting spend beyond what remains (grant budget guardrail). */
export async function recordGrantSpend(tx: any, grantId: string, amount: string) {
  const { toMinorUnits, fromMinorUnits } = await import('./money')
  const grant = await tx.grant.findUnique({ where: { id: grantId } })
  if (!grant) throw new Error('Grant not found')
  const newSpentMinor = toMinorUnits(grant.amountSpent.toString()) + toMinorUnits(amount)
  if (newSpentMinor > toMinorUnits(grant.totalAwarded.toString())) {
    throw new Error('This would exceed the grant\'s total awarded amount')
  }
  return tx.grant.update({ where: { id: grantId }, data: { amountSpent: fromMinorUnits(newSpentMinor) } })
}

export async function createProgram(tx: any, params: { organizationId: string; name: string; description?: string | null }) {
  return tx.program.create({ data: { organizationId: params.organizationId, name: params.name, description: params.description ?? null } })
}
