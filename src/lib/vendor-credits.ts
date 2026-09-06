/**
 * Domain logic for vendor credits (credit memos). Posting a vendor credit
 * reduces Accounts Payable immediately; applying it to a specific bill
 * additionally reduces that bill's amountPaid so its balance reflects the
 * credit without a cash payment.
 */
export async function findPayableAccount(tx: any, organizationId: string) {
  const account = await tx.account.findFirst({ where: { organizationId, subtype: 'payable' } })
  if (!account) throw new Error('No Accounts Payable account is configured for this organization')
  return account
}

/** Posts a vendor credit to the ledger: Debit Accounts Payable, Credit the expense account (contra-expense). */
export async function postVendorCreditToLedger(tx: any, credit: any, actorId: string) {
  if (credit.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: credit.journalEntryId }, include: { lines: true } })
  }

  const payable = await findPayableAccount(tx, credit.organizationId)
  const idempotencyKey = `vendor-credit:${credit.id}:post`

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: credit.organizationId,
      description: `Vendor credit ${credit.creditNumber}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: [
          { accountId: payable.id, amount: credit.amount, isDebit: true, description: `Vendor credit ${credit.creditNumber}` },
          { accountId: credit.expenseAccountId, amount: credit.amount, isDebit: false, description: `Vendor credit ${credit.creditNumber}` },
        ],
      },
    },
    include: { lines: true },
  })

  await tx.vendorCredit.update({ where: { id: credit.id }, data: { journalEntryId: entry.id } })

  await tx.auditEvent.create({
    data: {
      organizationId: credit.organizationId,
      actorId,
      action: 'vendor_credit.post',
      resourceType: 'vendor_credit',
      resourceId: credit.id,
      newState: { journalEntryId: entry.id },
    },
  })

  return entry
}

/** Applies (part of) a posted vendor credit's remaining balance to a bill, reducing what's owed. */
export async function applyVendorCreditToBill(tx: any, credit: any, bill: any, amount: string, actorId: string) {
  const { toMinorUnits, fromMinorUnits } = await import('./money')
  const remainingMinor = toMinorUnits(credit.remainingAmount.toString())
  const applyMinor = toMinorUnits(amount)
  if (applyMinor > remainingMinor) throw new Error('Amount exceeds the credit\'s remaining balance')

  const billOutstandingMinor = toMinorUnits(bill.total.toString()) - toMinorUnits(bill.amountPaid.toString())
  if (applyMinor > billOutstandingMinor) throw new Error('Amount exceeds the bill\'s outstanding balance')

  await tx.vendorCredit.update({
    where: { id: credit.id },
    data: { remainingAmount: fromMinorUnits(remainingMinor - applyMinor) },
  })
  const updatedBill = await tx.bill.update({
    where: { id: bill.id },
    data: { amountPaid: fromMinorUnits(toMinorUnits(bill.amountPaid.toString()) + applyMinor) },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: credit.organizationId,
      actorId,
      action: 'vendor_credit.apply',
      resourceType: 'vendor_credit',
      resourceId: credit.id,
      newState: { billId: bill.id, amount },
    },
  })

  return updatedBill
}
