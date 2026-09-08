/**
 * Intercompany transactions between two linked organizations (parent and
 * child, per Organization.parentOrganizationId). Posting requires four
 * accounts: the stored dueFromAccountId (asset on the initiating org) and
 * dueToAccountId (liability on the counterparty org) capture the
 * intercompany balance itself; the caller-supplied offset accounts are
 * the "other side" of each entry (e.g. cash paid / cash received, or a
 * revenue/expense recognition) and are not persisted beyond the posting.
 *
 *   Initiating org's entry:   Debit dueFromAccountId,        Credit organizationOffsetAccountId
 *   Counterparty org's entry: Debit counterpartyOffsetAccountId, Credit dueToAccountId
 *
 * Marking a transaction "eliminated" excludes its dueFrom/dueTo balances
 * from consolidated reporting (see computeConsolidatedTrialBalance below)
 * so the same balance isn't double-counted across the group.
 */

export async function postIntercompanyTransaction(
  tx: any,
  params: {
    organizationId: string
    counterpartyOrganizationId: string
    description?: string
    amount: string
    dueFromAccountId: string
    dueToAccountId: string
    organizationOffsetAccountId: string
    counterpartyOffsetAccountId: string
  },
  actorId: string
) {
  const [dueFromAccount, dueToAccount, orgOffsetAccount, counterpartyOffsetAccount] = await Promise.all([
    tx.account.findUnique({ where: { id: params.dueFromAccountId } }),
    tx.account.findUnique({ where: { id: params.dueToAccountId } }),
    tx.account.findUnique({ where: { id: params.organizationOffsetAccountId } }),
    tx.account.findUnique({ where: { id: params.counterpartyOffsetAccountId } }),
  ])
  if (!dueFromAccount || dueFromAccount.organizationId !== params.organizationId) {
    throw new Error('dueFromAccountId must belong to the initiating organization')
  }
  if (!dueToAccount || dueToAccount.organizationId !== params.counterpartyOrganizationId) {
    throw new Error('dueToAccountId must belong to the counterparty organization')
  }
  if (!orgOffsetAccount || orgOffsetAccount.organizationId !== params.organizationId) {
    throw new Error('organizationOffsetAccountId must belong to the initiating organization')
  }
  if (!counterpartyOffsetAccount || counterpartyOffsetAccount.organizationId !== params.counterpartyOrganizationId) {
    throw new Error('counterpartyOffsetAccountId must belong to the counterparty organization')
  }

  const record = await tx.intercompanyTransaction.create({
    data: {
      organizationId: params.organizationId,
      counterpartyOrganizationId: params.counterpartyOrganizationId,
      description: params.description,
      amount: params.amount,
      dueFromAccountId: params.dueFromAccountId,
      dueToAccountId: params.dueToAccountId,
    },
  })

  const idempotencyKey = `intercompany:${record.id}:org`
  const orgEntry = await tx.journalEntry.create({
    data: {
      organizationId: params.organizationId,
      description: params.description || `Intercompany transaction with ${params.counterpartyOrganizationId}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: [
          { accountId: params.dueFromAccountId, amount: params.amount, isDebit: true, description: 'Due from affiliate' },
          { accountId: params.organizationOffsetAccountId, amount: params.amount, isDebit: false, description: 'Intercompany transaction' },
        ],
      },
    },
  })

  const counterpartyIdempotencyKey = `intercompany:${record.id}:counterparty`
  const counterpartyEntry = await tx.journalEntry.create({
    data: {
      organizationId: params.counterpartyOrganizationId,
      description: params.description || `Intercompany transaction with ${params.organizationId}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey: counterpartyIdempotencyKey,
      lines: {
        create: [
          { accountId: params.counterpartyOffsetAccountId, amount: params.amount, isDebit: true, description: 'Intercompany transaction' },
          { accountId: params.dueToAccountId, amount: params.amount, isDebit: false, description: 'Due to affiliate' },
        ],
      },
    },
  })

  const updated = await tx.intercompanyTransaction.update({
    where: { id: record.id },
    data: { journalEntryId: orgEntry.id, counterpartyJournalEntryId: counterpartyEntry.id },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: params.organizationId,
      actorId,
      action: 'intercompany.post',
      resourceType: 'intercompany_transaction',
      resourceId: record.id,
      newState: { journalEntryId: orgEntry.id, counterpartyJournalEntryId: counterpartyEntry.id },
    },
  })

  return updated
}

/** Marks an intercompany transaction as eliminated so it's excluded from consolidated reporting. */
export async function eliminateIntercompanyTransaction(tx: any, id: string) {
  return tx.intercompanyTransaction.update({ where: { id }, data: { eliminated: true } })
}

/**
 * Consolidated trial balance across a parent organization and its direct
 * child organizations, netting out any intercompany balances marked
 * eliminated. Multi-level (grandchild) hierarchies are not supported —
 * see docs/known-limitations.md.
 */
export async function computeConsolidatedTrialBalance(tx: any, parentOrganizationId: string) {
  const children = await tx.organization.findMany({ where: { parentOrganizationId } })
  const orgIds = [parentOrganizationId, ...children.map((c: any) => c.id)]

  const accounts = await tx.account.findMany({ where: { organizationId: { in: orgIds } } })
  const accountsById = new Map(accounts.map((a: any) => [a.id, a]))

  const lines = await tx.journalLine.findMany({
    where: { accountId: { in: accounts.map((a: any) => a.id) }, journalEntry: { posted: true } },
  })

  const balances = new Map<string, number>()
  for (const line of lines) {
    const account: any = accountsById.get(line.accountId)
    if (!account) continue
    const signed = line.isDebit ? Number(line.amount) : -Number(line.amount)
    balances.set(line.accountId, (balances.get(line.accountId) || 0) + signed)
  }

  const eliminations = await tx.intercompanyTransaction.findMany({
    where: { organizationId: { in: orgIds }, eliminated: true },
  })
  for (const elimination of eliminations) {
    const amount = Number(elimination.amount)
    balances.set(elimination.dueFromAccountId, (balances.get(elimination.dueFromAccountId) || 0) - amount)
    balances.set(elimination.dueToAccountId, (balances.get(elimination.dueToAccountId) || 0) + amount)
  }

  const totals: Record<string, number> = { asset: 0, liability: 0, equity: 0, income: 0, expense: 0 }
  const lineItems = accounts.map((account: any) => {
    const balance = balances.get(account.id) || 0
    totals[account.type] = (totals[account.type] || 0) + balance
    return { accountId: account.id, name: account.name, type: account.type, organizationId: account.organizationId, balance }
  })

  return { organizationIds: orgIds, totals, accounts: lineItems, eliminationsApplied: eliminations.length }
}
