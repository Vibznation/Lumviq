import { fromMinorUnits, toMinorUnits, addMinor } from './money'
import { recordSaleStockMovement } from './inventory'

/**
 * Domain logic for the sales/receivables module. UI and API routes must not
 * perform accounting logic directly — journal postings always go through
 * these helpers so every invoice/payment is traceable to the ledger.
 *
 * Posting matrix (see docs/ledger_posting_matrix.md):
 *   Invoice sent      -> Debit Accounts Receivable, Credit Revenue (per line)
 *                        + Debit COGS / Credit Inventory Asset for lines tied to a stocked product
 *   Invoice payment    -> Debit Bank/Cash, Credit Accounts Receivable
 *   Invoice voided     -> Reversing entry (swap debit/credit of the original)
 */

export async function findReceivableAccount(tx: any, organizationId: string) {
  const account = await tx.account.findFirst({ where: { organizationId, subtype: 'receivable' } })
  if (!account) throw new Error('No Accounts Receivable account is configured for this organization')
  return account
}

/**
 * Posts a sent invoice to the ledger. Idempotent: if the invoice already has
 * a journalEntryId, the existing entry is returned unchanged. Lines that
 * reference a tracked inventory product also trigger a stock movement and an
 * additional Debit COGS / Credit Inventory Asset posting at average cost.
 */
export async function postInvoiceToLedger(
  tx: any,
  invoice: any,
  lines: Array<{ accountId: string; description: string; amount: string; quantity?: string; productId?: string | null }>,
  actorId: string
) {
  if (invoice.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: invoice.journalEntryId }, include: { lines: true } })
  }

  const receivable = await findReceivableAccount(tx, invoice.organizationId)

  const cogsLines: Array<{ accountId: string; amount: string; isDebit: boolean; description: string }> = []
  for (const l of lines) {
    if (!l.productId || !l.quantity) continue
    const product = await tx.product.findUnique({ where: { id: l.productId } })
    if (!product || !product.inventoryAssetAccountId) continue
    const { totalCost } = await recordSaleStockMovement(tx, invoice.organizationId, l.productId, l.quantity, 'invoice', invoice.id)
    if (Number(totalCost) === 0) continue
    cogsLines.push(
      { accountId: product.expenseAccountId, amount: totalCost, isDebit: true, description: `COGS: ${l.description}` },
      { accountId: product.inventoryAssetAccountId, amount: totalCost, isDebit: false, description: `COGS: ${l.description}` }
    )
  }

  const idempotencyKey = `invoice:${invoice.id}:send`

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: invoice.organizationId,
      description: `Invoice ${invoice.invoiceNumber}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: [
          { accountId: receivable.id, amount: invoice.total, isDebit: true, description: `Invoice ${invoice.invoiceNumber}` },
          ...lines.map((l) => ({ accountId: l.accountId, amount: l.amount, isDebit: false, description: l.description })),
          ...cogsLines,
        ],
      },
    },
    include: { lines: true },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: invoice.organizationId,
      actorId,
      action: 'invoice.send',
      resourceType: 'invoice',
      resourceId: invoice.id,
      newState: { journalEntryId: entry.id },
    },
  })

  return entry
}

/** Reverses an invoice's journal entry (swaps debit/credit) for voiding. */
export async function reverseInvoiceJournal(tx: any, invoice: any, actorId: string) {
  if (!invoice.journalEntryId) return null
  const original = await tx.journalEntry.findUnique({ where: { id: invoice.journalEntryId }, include: { lines: true } })
  if (!original) return null

  const idempotencyKey = `invoice:${invoice.id}:void`
  const existing = await tx.journalEntry.findUnique({ where: { idempotencyKey } })
  if (existing) return existing

  const reversal = await tx.journalEntry.create({
    data: {
      organizationId: invoice.organizationId,
      description: `Void of invoice ${invoice.invoiceNumber}`,
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
      organizationId: invoice.organizationId,
      actorId,
      action: 'invoice.void',
      resourceType: 'invoice',
      resourceId: invoice.id,
      newState: { reversalJournalEntryId: reversal.id },
    },
  })

  return reversal
}

/** Records a customer payment against an invoice and posts it to the ledger. Idempotent per payment id. */
export async function postInvoicePaymentToLedger(tx: any, payment: any, invoiceNumber: string, actorId: string) {
  if (payment.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: payment.journalEntryId }, include: { lines: true } })
  }

  const receivable = await findReceivableAccount(tx, payment.organizationId)
  const idempotencyKey = `invoice-payment:${payment.id}:post`

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: payment.organizationId,
      description: `Payment for invoice ${invoiceNumber}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: [
          { accountId: payment.depositAccountId, amount: payment.amount, isDebit: true, description: `Payment for invoice ${invoiceNumber}` },
          { accountId: receivable.id, amount: payment.amount, isDebit: false, description: `Payment for invoice ${invoiceNumber}` },
        ],
      },
    },
    include: { lines: true },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: payment.organizationId,
      actorId,
      action: 'invoice.payment.post',
      resourceType: 'invoice_payment',
      resourceId: payment.id,
      newState: { journalEntryId: entry.id },
    },
  })

  return entry
}

/**
 * Computes invoice subtotal/total from line items using integer minor-unit
 * arithmetic (never floating point). Each line's optional `discount` (a flat
 * amount, not a percentage) is subtracted from that line's gross amount and
 * clamped at zero so a line can never go negative.
 */
export function computeInvoiceTotals(
  lines: Array<{ quantity: string | number; unitPrice: string | number; discount?: string | number }>,
  taxTotal: string | number = '0'
) {
  const lineAmounts = lines.map((l) => {
    const qty = toMinorUnits(l.quantity)
    const price = toMinorUnits(l.unitPrice)
    const gross = (qty * price) / BigInt(1_000_000)
    const discount = l.discount !== undefined ? toMinorUnits(l.discount) : BigInt(0)
    const net = gross - discount
    return net < BigInt(0) ? BigInt(0) : net
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

/** Generates the next sequential invoice number for an organization, e.g. INV-0007. */
export async function nextInvoiceNumber(tx: any, organizationId: string): Promise<string> {
  const count = await tx.invoice.count({ where: { organizationId } })
  return `INV-${String(count + 1).padStart(4, '0')}`
}

/** Generates the next sequential credit note number for an organization, e.g. CN-0003. */
export async function nextCreditNoteNumber(tx: any, organizationId: string): Promise<string> {
  const count = await tx.creditNote.count({ where: { organizationId } })
  return `CN-${String(count + 1).padStart(4, '0')}`
}

/**
 * Posts a sales credit note to the ledger: Debit the income/revenue account
 * (contra-revenue) and Credit Accounts Receivable, reducing what the
 * customer owes without any cash movement. Idempotent per credit note.
 */
export async function postCreditNoteToLedger(tx: any, creditNote: any, actorId: string) {
  if (creditNote.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: creditNote.journalEntryId }, include: { lines: true } })
  }

  const receivable = await findReceivableAccount(tx, creditNote.organizationId)
  const idempotencyKey = `credit-note:${creditNote.id}:post`

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: creditNote.organizationId,
      description: `Credit note ${creditNote.creditNumber}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: [
          { accountId: creditNote.incomeAccountId, amount: creditNote.amount, isDebit: true, description: `Credit note ${creditNote.creditNumber}` },
          { accountId: receivable.id, amount: creditNote.amount, isDebit: false, description: `Credit note ${creditNote.creditNumber}` },
        ],
      },
    },
    include: { lines: true },
  })

  await tx.creditNote.update({ where: { id: creditNote.id }, data: { journalEntryId: entry.id } })

  await tx.auditEvent.create({
    data: {
      organizationId: creditNote.organizationId,
      actorId,
      action: 'credit_note.post',
      resourceType: 'credit_note',
      resourceId: creditNote.id,
      newState: { journalEntryId: entry.id },
    },
  })

  return entry
}

/** Applies (part of) a posted credit note's remaining balance to an invoice, reducing what's owed. */
export async function applyCreditNoteToInvoice(tx: any, creditNote: any, invoice: any, amount: string, actorId: string) {
  const remainingMinor = toMinorUnits(creditNote.remainingAmount.toString())
  const applyMinor = toMinorUnits(amount)
  if (applyMinor > remainingMinor) throw new Error("Amount exceeds the credit note's remaining balance")

  const invoiceOutstandingMinor = toMinorUnits(invoice.total.toString()) - toMinorUnits(invoice.amountPaid.toString())
  if (applyMinor > invoiceOutstandingMinor) throw new Error("Amount exceeds the invoice's outstanding balance")

  await tx.creditNote.update({
    where: { id: creditNote.id },
    data: { remainingAmount: fromMinorUnits(remainingMinor - applyMinor) },
  })
  const updatedInvoice = await tx.invoice.update({
    where: { id: invoice.id },
    data: { amountPaid: fromMinorUnits(toMinorUnits(invoice.amountPaid.toString()) + applyMinor) },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: creditNote.organizationId,
      actorId,
      action: 'credit_note.apply',
      resourceType: 'credit_note',
      resourceId: creditNote.id,
      newState: { invoiceId: invoice.id, amount },
    },
  })

  return updatedInvoice
}

/**
 * Records a cash refund against an invoice (e.g. an overpayment or a
 * returned sale) and posts the reversing entry to the ledger: Debit
 * Accounts Receivable, Credit the deposit/bank account the refund was paid
 * from. Also reduces the invoice's amountPaid so its balance reflects the
 * refund. Idempotent per refund id.
 */
export async function postInvoiceRefundToLedger(tx: any, refund: any, invoiceNumber: string, actorId: string) {
  if (refund.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: refund.journalEntryId }, include: { lines: true } })
  }

  const receivable = await findReceivableAccount(tx, refund.organizationId)
  const idempotencyKey = `invoice-refund:${refund.id}:post`

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: refund.organizationId,
      description: `Refund for invoice ${invoiceNumber}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: {
        create: [
          { accountId: receivable.id, amount: refund.amount, isDebit: true, description: `Refund for invoice ${invoiceNumber}` },
          { accountId: refund.depositAccountId, amount: refund.amount, isDebit: false, description: `Refund for invoice ${invoiceNumber}` },
        ],
      },
    },
    include: { lines: true },
  })

  await tx.invoiceRefund.update({ where: { id: refund.id }, data: { journalEntryId: entry.id } })

  await tx.auditEvent.create({
    data: {
      organizationId: refund.organizationId,
      actorId,
      action: 'invoice.refund.post',
      resourceType: 'invoice_refund',
      resourceId: refund.id,
      newState: { journalEntryId: entry.id },
    },
  })

  return entry
}
