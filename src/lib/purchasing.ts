import { fromMinorUnits, toMinorUnits, addMinor } from './money'
import { recordPurchaseStockMovement } from './inventory'

/**
 * Domain logic for the purchasing/payables module. Mirrors src/lib/invoicing.ts.
 *
 * Posting matrix (see docs/ledger_posting_matrix.md):
 *   Bill sent (posted)  -> Debit Expense/Asset per line, Credit Accounts Payable
 *   Bill payment        -> Debit Accounts Payable, Credit Bank/Cash
 *   Bill voided          -> Reversing entry (swap debit/credit of the original)
 */

export async function findPayableAccount(tx: any, organizationId: string) {
  const account = await tx.account.findFirst({ where: { organizationId, subtype: 'payable' } })
  if (!account) throw new Error('No Accounts Payable account is configured for this organization')
  return account
}

/**
 * Flags likely duplicate bills: same vendor, same total, issued within 7
 * days of each other, or a matching vendorReference. Non-blocking — the
 * caller surfaces this as a warning, it never prevents bill creation.
 */
export async function findPotentialDuplicateBills(
  tx: any,
  params: { organizationId: string; vendorId: string; total: string; issueDate: Date; vendorReference?: string | null }
) {
  const windowStart = new Date(params.issueDate)
  windowStart.setDate(windowStart.getDate() - 7)
  const windowEnd = new Date(params.issueDate)
  windowEnd.setDate(windowEnd.getDate() + 7)

  return tx.bill.findMany({
    where: {
      organizationId: params.organizationId,
      vendorId: params.vendorId,
      OR: [
        { total: params.total, issueDate: { gte: windowStart, lte: windowEnd } },
        ...(params.vendorReference ? [{ vendorReference: params.vendorReference }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
}


/**
 * Posts a bill to the ledger. Idempotent: if the bill already has a
 * journalEntryId, the existing entry is returned unchanged. Lines that
 * reference a tracked inventory product increase stock on hand at the
 * line's unit price (recomputing the product's average cost).
 */
export async function postBillToLedger(
  tx: any,
  bill: any,
  lines: Array<{ accountId: string; description: string; amount: string; quantity?: string; unitPrice?: string; productId?: string | null }>,
  actorId: string
) {
  if (bill.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: bill.journalEntryId }, include: { lines: true } })
  }

  const payable = await findPayableAccount(tx, bill.organizationId)

  for (const l of lines) {
    if (!l.productId || !l.quantity || !l.unitPrice) continue
    await recordPurchaseStockMovement(tx, bill.organizationId, l.productId, l.quantity, l.unitPrice, 'bill', bill.id)
  }

  const idempotencyKey = `bill:${bill.id}:send`

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: bill.organizationId,
      description: `Bill ${bill.billNumber}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: [
          ...lines.map((l) => ({ accountId: l.accountId, amount: l.amount, isDebit: true, description: l.description })),
          { accountId: payable.id, amount: bill.total, isDebit: false, description: `Bill ${bill.billNumber}` },
        ],
      },
    },
    include: { lines: true },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: bill.organizationId,
      actorId,
      action: 'bill.send',
      resourceType: 'bill',
      resourceId: bill.id,
      newState: { journalEntryId: entry.id },
    },
  })

  return entry
}

/** Reverses a bill's journal entry (swaps debit/credit) for voiding. */
export async function reverseBillJournal(tx: any, bill: any, actorId: string) {
  if (!bill.journalEntryId) return null
  const original = await tx.journalEntry.findUnique({ where: { id: bill.journalEntryId }, include: { lines: true } })
  if (!original) return null

  const idempotencyKey = `bill:${bill.id}:void`
  const existing = await tx.journalEntry.findUnique({ where: { idempotencyKey } })
  if (existing) return existing

  const reversal = await tx.journalEntry.create({
    data: {
      organizationId: bill.organizationId,
      description: `Void of bill ${bill.billNumber}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: original.lines.map((l: any) => ({
          accountId: l.accountId,
          amount: l.amount,
          isDebit: !l.isDebit,
          description: `Reversal: ${l.description || ''}`.trim(),
        })),
      },
    },
    include: { lines: true },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: bill.organizationId,
      actorId,
      action: 'bill.void',
      resourceType: 'bill',
      resourceId: bill.id,
      newState: { reversalJournalEntryId: reversal.id },
    },
  })

  return reversal
}

/** Records a payment against a bill and posts it to the ledger. Idempotent per payment id. */
export async function postBillPaymentToLedger(tx: any, payment: any, billNumber: string, actorId: string) {
  if (payment.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: payment.journalEntryId }, include: { lines: true } })
  }

  const payable = await findPayableAccount(tx, payment.organizationId)
  const idempotencyKey = `bill-payment:${payment.id}:post`

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: payment.organizationId,
      description: `Payment for bill ${billNumber}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: [
          { accountId: payable.id, amount: payment.amount, isDebit: true, description: `Payment for bill ${billNumber}` },
          { accountId: payment.paymentAccountId, amount: payment.amount, isDebit: false, description: `Payment for bill ${billNumber}` },
        ],
      },
    },
    include: { lines: true },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: payment.organizationId,
      actorId,
      action: 'bill.payment.post',
      resourceType: 'bill_payment',
      resourceId: payment.id,
      newState: { journalEntryId: entry.id },
    },
  })

  return entry
}

/**
 * Creates a bill payment and posts it to the ledger, updating the bill's
 * amountPaid/status. Shared by the direct payment API route and the
 * approvals executor (see src/lib/approvals.ts) so a payment that requires
 * approval is created identically whether it posts immediately or only
 * after sign-off.
 */
export async function createAndPostBillPayment(
  tx: any,
  bill: any,
  input: { amount: string; paymentDate: string | Date; method?: string | null; paymentAccountId: string },
  actorId: string
) {
  const payment = await tx.billPayment.create({
    data: {
      billId: bill.id,
      organizationId: bill.organizationId,
      amount: input.amount,
      paymentDate: new Date(input.paymentDate),
      method: input.method || null,
      paymentAccountId: input.paymentAccountId,
    },
  })

  const entry = await postBillPaymentToLedger(tx, payment, bill.billNumber, actorId)
  await tx.billPayment.update({ where: { id: payment.id }, data: { journalEntryId: entry.id } })

  const amountMinor = toMinorUnits(input.amount)
  const newAmountPaidMinor = toMinorUnits(bill.amountPaid.toString()) + amountMinor
  const newStatus = newAmountPaidMinor >= toMinorUnits(bill.total.toString()) ? 'paid' : 'partially_paid'

  return tx.bill.update({
    where: { id: bill.id },
    data: { amountPaid: fromMinorUnits(newAmountPaidMinor), status: newStatus },
    include: { lines: true, vendor: true, payments: true },
  })
}

/** Computes bill subtotal/total from line items using integer minor-unit arithmetic (never floating point). */
export function computeBillTotals(lines: Array<{ quantity: string | number; unitPrice: string | number }>, taxTotal: string | number = '0') {
  const lineAmounts = lines.map((l) => {
    const qty = toMinorUnits(l.quantity)
    const price = toMinorUnits(l.unitPrice)
    return (qty * price) / BigInt(1_000_000)
  })
  const subtotal = addMinor(...lineAmounts)
  const tax = toMinorUnits(taxTotal)
  const total = subtotal + tax
  return {
    lineAmounts: lineAmounts.map(fromMinorUnits),
    subtotal: fromMinorUnits(subtotal),
    taxTotal: fromMinorUnits(tax),
    total: fromMinorUnits(total),
  }
}

/** Generates the next sequential bill number for an organization, e.g. BILL-0007. */
export async function nextBillNumber(tx: any, organizationId: string): Promise<string> {
  const count = await tx.bill.count({ where: { organizationId } })
  return `BILL-${String(count + 1).padStart(4, '0')}`
}
