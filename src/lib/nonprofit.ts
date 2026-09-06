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

function findContributionRevenueAccount(tx: any, organizationId: string) {
  return tx.account.findFirst({ where: { organizationId, type: 'income' } })
}

/** Posts a one-time donation to the ledger: Debit deposit account (cash), Credit contribution revenue. */
export async function postDonationToLedger(tx: any, donation: any, actorId: string) {
  if (donation.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: donation.journalEntryId }, include: { lines: true } })
  }

  const revenue = await findContributionRevenueAccount(tx, donation.organizationId)
  if (!revenue) throw new Error('No income account is configured to record contribution revenue')

  const idempotencyKey = `donation:${donation.id}:post`
  const entry = await tx.journalEntry.create({
    data: {
      organizationId: donation.organizationId,
      description: `Donation from ${donation.donorName}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      fundId: donation.fundId,
      lines: {
        create: [
          { accountId: donation.depositAccountId, amount: donation.amount, isDebit: true, description: `Donation from ${donation.donorName}` },
          { accountId: revenue.id, amount: donation.amount, isDebit: false, description: `Donation from ${donation.donorName}` },
        ],
      },
    },
    include: { lines: true },
  })

  await tx.donation.update({ where: { id: donation.id }, data: { journalEntryId: entry.id } })

  await tx.auditEvent.create({
    data: {
      organizationId: donation.organizationId,
      actorId,
      action: 'donation.post',
      resourceType: 'donation',
      resourceId: donation.id,
      newState: { journalEntryId: entry.id },
    },
  })

  return entry
}

/** Records a fulfilling donation against a pledge, capping at the pledge's remaining amount. */
export async function fulfillPledge(tx: any, pledge: any, amount: string) {
  const { toMinorUnits, fromMinorUnits } = await import('./money')
  const fulfilledMinor = toMinorUnits(pledge.fulfilledAmount.toString())
  const addMinor = toMinorUnits(amount)
  const totalMinor = toMinorUnits(pledge.amount.toString())
  const newFulfilled = fulfilledMinor + addMinor
  if (newFulfilled > totalMinor) throw new Error('This would exceed the pledge amount')
  return tx.pledge.update({
    where: { id: pledge.id },
    data: {
      fulfilledAmount: fromMinorUnits(newFulfilled),
      status: newFulfilled >= totalMinor ? 'fulfilled' : 'open',
    },
  })
}
