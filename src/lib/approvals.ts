import { createNotification } from './notifications'
import { createAndPostBillPayment } from './purchasing'

/**
 * Approval gating for sensitive money-moving actions, per prompt.md's
 * ROLES AND PERMISSIONS approval-rule categories (bills, expenses,
 * payments, purchase orders, journal entries, payroll runs, budgets,
 * vendor/banking changes).
 *
 * Only bill payments are wired end-to-end as a reference implementation:
 * when a bill payment's amount is at or above its threshold, the payment
 * is NOT created or posted immediately — an Approval record is created
 * instead, carrying the parameters needed to create it later. Approving
 * it executes the payment for the first time; rejecting it never posts
 * anything. Other categories listed in APPROVAL_THRESHOLDS are defined
 * but not yet wired into their respective API routes — see
 * docs/known-limitations.md.
 */
export const APPROVAL_THRESHOLDS: Record<string, number> = {
  'bill-payment': 500,
}

export function amountRequiresApproval(resourceType: string, amount: number): boolean {
  const threshold = APPROVAL_THRESHOLDS[resourceType]
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

/** Executes the pending action for an approved approval. Only 'bill-payment' is implemented. */
async function executeApprovedAction(tx: any, approval: any, actorId: string) {
  if (approval.resourceType === 'bill-payment') {
    const bill = await tx.bill.findUnique({ where: { id: approval.resourceId } })
    if (!bill) throw new Error('Bill for this approval no longer exists')
    return createAndPostBillPayment(tx, bill, approval.payload as any, actorId)
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
