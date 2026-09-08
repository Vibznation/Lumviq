import { createNotification } from './notifications'
import { createAndPostBillPayment } from './purchasing'
import { postJournalEntryTx, type JournalEntry } from './ledger'
import { postReimbursementToLedger } from './reimbursements'
import { postPayRunToLedger } from './payroll'

/**
 * Approval gating for sensitive money-moving actions, per prompt.md's
 * ROLES AND PERMISSIONS approval-rule categories (bills, expenses,
 * payments, purchase orders, journal entries, payroll runs, budgets,
 * vendor/banking changes).
 *
 * Wired end-to-end as of this pass: bill payments, reimbursement payouts,
 * purchase order issuance (draft -> sent), manual journal entries, and
 * payroll run posting. For each, when the amount is at or above its
 * threshold, the money-moving action is NOT executed immediately — an
 * Approval record is created carrying the parameters needed to execute it
 * later. Approving it executes the action for the first time; rejecting
 * it never posts/commits anything. Budgets and vendor-banking-change
 * approval categories are defined but not yet wired into their routes —
 * see docs/known-limitations.md.
 *
 * Organizations can override any default threshold via
 * Organization.approvalThresholds (see src/pages/api/settings/approval-
 * thresholds.ts) — pass that JSON map as the third argument to
 * amountRequiresApproval when available.
 *
 * Budget changes (`POST /api/budgets`) are gated the same amount-
 * threshold way. Banking-detail changes (currently limited to editing
 * an existing `BankAccount`'s provider/account-number via `PATCH
 * /api/banking/accounts/[id]`) are not amount-based — any change to the
 * account number always requires approval, regardless of threshold.
 * Vendor-side ACH/banking details don't exist in the schema yet, so
 * that half of "vendor/banking-detail changes" remains unimplemented —
 * see docs/known-limitations.md.
 */
export const APPROVAL_THRESHOLDS: Record<string, number> = {
  'bill-payment': 500,
  'reimbursement-payment': 500,
  'purchase-order': 1000,
  'journal-entry': 1000,
  'payroll-run': 0,
  'budget-change': 5000,
}

export function amountRequiresApproval(
  resourceType: string,
  amount: number,
  orgThresholds?: Record<string, unknown> | null
): boolean {
  const override = orgThresholds && typeof orgThresholds[resourceType] === 'number' ? (orgThresholds[resourceType] as number) : undefined
  const threshold = override ?? APPROVAL_THRESHOLDS[resourceType]
  if (threshold == null) return false
  return amount >= threshold
}

export async function requestApproval(
  tx: any,
  params: {
    organizationId: string
    resourceType: string
    resourceId: string
    amount?: string | number | null
    payload?: unknown
    requestedByUserId: string
    note?: string
  }
) {
  const approval = await tx.approval.create({
    data: {
      organizationId: params.organizationId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      amount: params.amount != null ? params.amount.toString() : null,
      payload: params.payload ?? undefined,
      requestedByUserId: params.requestedByUserId,
      note: params.note,
      status: 'pending',
    },
  })
  await createNotification(tx, {
    organizationId: params.organizationId,
    type: 'approval.requested',
    title: 'Approval requested',
    message: `A ${params.resourceType.replace('-', ' ')} of ${params.amount ?? 'unspecified amount'} needs approval.`,
    link: '/approvals',
  })
  return approval
}

/** Executes the pending action for an approved approval. */
async function executeApprovedAction(tx: any, approval: any, actorId: string) {
  if (approval.resourceType === 'bill-payment') {
    const bill = await tx.bill.findUnique({ where: { id: approval.resourceId } })
    if (!bill) throw new Error('Bill for this approval no longer exists')
    return createAndPostBillPayment(tx, bill, approval.payload as any, actorId)
  }

  if (approval.resourceType === 'reimbursement-payment') {
    const reimbursement = await tx.reimbursement.findUnique({ where: { id: approval.resourceId } })
    if (!reimbursement) throw new Error('Reimbursement for this approval no longer exists')
    if (reimbursement.status === 'paid') return reimbursement
    const payload = approval.payload as { paymentAccountId: string }
    await tx.reimbursement.update({ where: { id: reimbursement.id }, data: { paymentAccountId: payload.paymentAccountId } })
    const withLines = await tx.reimbursement.findUnique({ where: { id: reimbursement.id }, include: { lines: true } })
    await postReimbursementToLedger(tx, withLines, actorId)
    return tx.reimbursement.findUnique({ where: { id: reimbursement.id } })
  }

  if (approval.resourceType === 'purchase-order') {
    const po = await tx.purchaseOrder.findUnique({ where: { id: approval.resourceId } })
    if (!po) throw new Error('Purchase order for this approval no longer exists')
    if (po.status !== 'draft') return po
    return tx.purchaseOrder.update({ where: { id: po.id }, data: { status: 'sent' } })
  }

  if (approval.resourceType === 'journal-entry') {
    const entry = approval.payload as JournalEntry
    return postJournalEntryTx(tx, entry, actorId)
  }

  if (approval.resourceType === 'payroll-run') {
    const payRun = await tx.payRun.findUnique({ where: { id: approval.resourceId } })
    if (!payRun) throw new Error('Pay run for this approval no longer exists')
    if (payRun.status !== 'draft') return tx.payRun.findUnique({ where: { id: payRun.id }, include: { lines: { include: { employee: true } } } })
    const entry = await postPayRunToLedger(tx, payRun, actorId)
    return tx.payRun.update({
      where: { id: payRun.id },
      data: { status: 'posted', journalEntryId: entry.id, postedAt: new Date() },
      include: { lines: { include: { employee: true } } },
    })
  }

  if (approval.resourceType === 'budget-change') {
    const payload = approval.payload as { organizationId: string; accountId: string; periodMonth: number; periodYear: number; amount: string | number }
    return tx.budget.upsert({
      where: {
        organizationId_accountId_periodMonth_periodYear: {
          organizationId: payload.organizationId,
          accountId: payload.accountId,
          periodMonth: payload.periodMonth,
          periodYear: payload.periodYear,
        },
      },
      update: { amount: payload.amount },
      create: { organizationId: payload.organizationId, accountId: payload.accountId, periodMonth: payload.periodMonth, periodYear: payload.periodYear, amount: payload.amount },
    })
  }

  if (approval.resourceType === 'banking-detail-change') {
    const payload = approval.payload as { name?: string; provider?: string; accountNumber?: string; currency?: string }
    const account = await tx.bankAccount.findUnique({ where: { id: approval.resourceId } })
    if (!account) throw new Error('Bank account for this approval no longer exists')
    return tx.bankAccount.update({
      where: { id: approval.resourceId },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.provider !== undefined ? { provider: payload.provider } : {}),
        ...(payload.accountNumber !== undefined ? { accountNumber: payload.accountNumber } : {}),
        ...(payload.currency !== undefined ? { currency: payload.currency } : {}),
      },
    })
  }

  return null
}

export async function decideApproval(
  tx: any,
  params: { approvalId: string; decidedByUserId: string; decision: 'approved' | 'rejected'; note?: string }
) {
  const approval = await tx.approval.findUnique({ where: { id: params.approvalId } })
  if (!approval) throw new Error('Approval not found')
  if (approval.status !== 'pending') throw new Error('Approval has already been decided')

  let executionResult: any = null
  if (params.decision === 'approved') {
    executionResult = await executeApprovedAction(tx, approval, params.decidedByUserId)
  }

  const updated = await tx.approval.update({
    where: { id: params.approvalId },
    data: {
      status: params.decision,
      decidedByUserId: params.decidedByUserId,
      decidedAt: new Date(),
      note: params.note ?? approval.note,
    },
  })

  await createNotification(tx, {
    organizationId: approval.organizationId,
    type: `approval.${params.decision}`,
    title: `Approval ${params.decision}`,
    message: `The ${approval.resourceType.replace('-', ' ')} you requested was ${params.decision}.`,
    link: '/approvals',
  })

  return { approval: updated, executionResult }
}
