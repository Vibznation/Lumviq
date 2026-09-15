/**
 * Payroll-run workflow engine: orchestrates the pay-run lifecycle against
 * a connected PayrollProvider (src/lib/integrations/payroll.ts). This is
 * the "real" full-service workflow layered on top of the provider
 * adapter; organizations without a connected provider keep using the
 * original manual-entry flow (enter a licensed provider's totals by hand
 * via PATCH /api/pay-runs/[id], then POST .../post) unchanged.
 *
 * Status lifecycle:
 *   draft -> calculating -> calculated | needs_attention
 *         -> awaiting_approval -> approved -> submitted -> processing
 *         -> partially_processed | paid -> completed
 *   (any active state) -> cancelled | voided | failed
 *   completed -> reversed (creates a new reversal PayRun)
 *
 * Ledger posting only ever happens once, when a run reaches paid/completed
 * (see syncPayRunStatus) or via the pre-existing manual "post to ledger"
 * action for orgs without a connected provider — postPayRunToLedger
 * itself is idempotent either way (src/lib/payroll.ts).
 */
import { getPayrollProvider } from './integrations/payroll-sandbox'
import type { PayrollCalculationRequest, PayrollProvider } from './integrations/payroll'
import { postPayRunToLedger } from './payroll'
import { requestApproval } from './approvals'
import { postJournalEntryTx } from './ledger'

export class PayrollProviderNotConnectedError extends Error {
  constructor() {
    super(
      'No payroll provider is connected for this organization. A licensed payroll provider must be contracted and connected before payroll can be calculated or submitted — see /settings/integrations.'
    )
    this.name = 'PayrollProviderNotConnectedError'
  }
}

export class SeparationOfDutiesError extends Error {
  constructor() {
    super('The person who prepared this pay run cannot also approve it. Ask another authorized user to approve.')
    this.name = 'SeparationOfDutiesError'
  }
}

function requireProvider(): PayrollProvider {
  const provider = getPayrollProvider()
  if (!provider || !provider.isConfigured()) throw new PayrollProviderNotConnectedError()
  return provider
}

/** True when a real (or sandbox test-mode) payroll provider is connected. */
export function isProviderConnected(): boolean {
  const provider = getPayrollProvider()
  return Boolean(provider && provider.isConfigured())
}

/**
 * Runs provider calculation for a draft/needs_attention pay run and
 * writes the results back onto the PayRun + PayRunLine rows.
 */
export async function calculatePayRun(tx: any, payRunId: string, actorId: string) {
  const payRun = await tx.payRun.findUnique({ where: { id: payRunId }, include: { lines: true } })
  if (!payRun) throw new Error('Pay run not found')
  if (payRun.status !== 'draft' && payRun.status !== 'needs_attention') {
    throw new Error('Only draft or needs_attention pay runs can be calculated')
  }
  const provider = requireProvider()

  const request: PayrollCalculationRequest = {
    companyExternalId: payRun.organizationId,
    payPeriodStart: payRun.payPeriodStart.toISOString(),
    payPeriodEnd: payRun.payPeriodEnd.toISOString(),
    offCycle: payRun.offCycle,
    lines: payRun.lines.map((l: any) => ({
      employeeExternalId: l.employeeId,
      regularHours: l.regularHours != null ? Number(l.regularHours) : undefined,
      overtimeHours: l.overtimeHours != null ? Number(l.overtimeHours) : undefined,
      grossPay: l.grossPay.toString(),
      reimbursements: l.reimbursements?.toString() ?? '0',
    })),
  }
  const result = payRun.offCycle ? await provider.createOffCyclePayroll(request) : await provider.calculatePayroll(request)

  let totalGarnishments = 0
  let totalEmployerBenefitsCost = 0
  for (const line of result.lines) {
    totalGarnishments += Number(line.garnishments || 0)
    totalEmployerBenefitsCost += Number(line.employerBenefitsCost || 0)
    await tx.payRunLine.updateMany({
      where: { payRunId: payRun.id, employeeId: line.employeeExternalId },
      data: {
        grossPay: line.grossPay,
        pretaxDeductions: line.pretaxDeductions,
        employeeTax: line.employeeTax,
        posttaxDeductions: line.posttaxDeductions,
        garnishmentAmount: line.garnishments,
        reimbursements: line.reimbursements,
        employerTax: line.employerTax,
        employerBenefitsCost: line.employerBenefitsCost,
        netPay: line.netPay,
      },
    })
  }

  const updated = await tx.payRun.update({
    where: { id: payRun.id },
    data: {
      status: result.status,
      providerPayrollId: result.providerPayrollId,
      preparedByUserId: payRun.preparedByUserId ?? actorId,
      totalGross: result.totalGross,
      totalEmployeeTax: result.totalEmployeeTax,
      totalEmployerTax: result.totalEmployerTax,
      totalPretaxDeductions: result.totalPretaxDeductions,
      totalPosttaxDeductions: result.totalPosttaxDeductions,
      totalGarnishments: totalGarnishments.toFixed(2),
      totalReimbursements: result.totalReimbursements,
      totalEmployerBenefitsCost: totalEmployerBenefitsCost.toFixed(2),
      debitDate: new Date(result.debitDate),
      employeePaymentDate: new Date(result.employeePaymentDate),
    },
    include: { lines: { include: { employee: true } } },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: payRun.organizationId,
      actorId,
      action: 'pay_run.calculate',
      resourceType: 'pay_run',
      resourceId: payRun.id,
      newState: { status: result.status, providerPayrollId: result.providerPayrollId, warnings: result.warnings },
    },
  })

  return { payRun: updated, warnings: result.warnings }
}

/**
 * Moves a calculated pay run to awaiting_approval and creates the
 * (always-required, per APPROVAL_THRESHOLDS['payroll-run'] = 0) Approval
 * record. The preparer (whoever calculated it) is recorded so a
 * separation-of-duties check can be enforced when it is decided.
 */
export async function submitPayRunForApproval(tx: any, payRunId: string, actorId: string) {
  const payRun = await tx.payRun.findUnique({ where: { id: payRunId } })
  if (!payRun) throw new Error('Pay run not found')
  if (payRun.status !== 'calculated') throw new Error('Only calculated pay runs can be submitted for approval')

  const updated = await tx.payRun.update({
    where: { id: payRun.id },
    data: { status: 'awaiting_approval', preparedByUserId: payRun.preparedByUserId ?? actorId },
  })

  const total = Number(updated.totalNetPay) + Number(updated.totalEmployerTax) + Number(updated.totalEmployerBenefitsCost)
  const approval = await requestApproval(tx, {
    organizationId: payRun.organizationId,
    resourceType: 'payroll-run',
    resourceId: payRun.id,
    amount: total,
    requestedByUserId: updated.preparedByUserId,
    note: `Pay run ${payRun.payPeriodStart.toISOString().slice(0, 10)} – ${payRun.payPeriodEnd.toISOString().slice(0, 10)}`,
  })

  return { payRun: updated, approval }
}

/**
 * Called from executeApprovedAction (src/lib/approvals.ts) once an
 * awaiting_approval pay run's Approval has been approved by someone other
 * than the preparer. Tells the provider to submit the run for real
 * processing; ledger posting happens later, when syncPayRunStatus
 * observes paid/completed.
 */
export async function submitApprovedPayRun(tx: any, payRunId: string, actorId: string) {
  const payRun = await tx.payRun.findUnique({ where: { id: payRunId } })
  if (!payRun) throw new Error('Pay run not found')
  if (payRun.status !== 'awaiting_approval') {
    return tx.payRun.findUnique({ where: { id: payRunId }, include: { lines: { include: { employee: true } } } })
  }
  if (!payRun.providerPayrollId) throw new Error('Pay run has no provider payroll id to submit')
  const provider = requireProvider()
  const submission = await provider.approvePayroll(payRun.providerPayrollId)

  const updated = await tx.payRun.update({
    where: { id: payRun.id },
    data: { status: submission.status, approvedByUserId: actorId, approvedAt: new Date() },
    include: { lines: { include: { employee: true } } },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: payRun.organizationId,
      actorId,
      action: 'pay_run.submit',
      resourceType: 'pay_run',
      resourceId: payRun.id,
      newState: { status: submission.status },
    },
  })

  return updated
}

/**
 * Polls the provider for the current status of a submitted pay run and,
 * once it reports paid/completed, posts the accounting impact to the
 * ledger (idempotent — see postPayRunToLedger). Intended to be called
 * either from the payroll webhook handler or a manual "check status"
 * action in the UI.
 */
/** Creates a PayStub row for each pay-run line that doesn't already have one (idempotent, called once a run reaches completed). */
async function generatePayStubs(tx: any, payRun: any) {
  const payDate = payRun.employeePaymentDate ?? new Date()
  for (const line of payRun.lines) {
    const existing = await tx.payStub.findUnique({ where: { payRunLineId: line.id } })
    if (existing) continue
    await tx.payStub.create({ data: { payRunId: payRun.id, payRunLineId: line.id, employeeId: line.employeeId, payDate } })
  }
}

export async function syncPayRunStatus(tx: any, payRunId: string, actorId: string) {
  const payRun = await tx.payRun.findUnique({ where: { id: payRunId }, include: { lines: { include: { employee: true } } } })
  if (!payRun) throw new Error('Pay run not found')
  if (!payRun.providerPayrollId) return payRun
  if (['completed', 'cancelled', 'voided', 'reversed', 'failed'].includes(payRun.status)) return payRun

  const provider = requireProvider()
  const submission = await provider.retrievePayroll(payRun.providerPayrollId)

  let status = submission.status as string
  let journalEntryId = payRun.journalEntryId
  let postedAt = payRun.postedAt

  if ((submission.status === 'paid' || submission.status === 'completed') && !payRun.journalEntryId) {
    const entry = await postPayRunToLedger(tx, payRun, actorId)
    journalEntryId = entry.id
    postedAt = new Date()
    status = 'completed'
    await generatePayStubs(tx, payRun)
  }

  const updated = await tx.payRun.update({
    where: { id: payRun.id },
    data: { status, journalEntryId, postedAt },
    include: { lines: { include: { employee: true } } },
  })

  if (updated.status !== payRun.status) {
    await tx.auditEvent.create({
      data: {
        organizationId: payRun.organizationId,
        actorId,
        action: 'pay_run.sync_status',
        resourceType: 'pay_run',
        resourceId: payRun.id,
        newState: { status: updated.status, journalEntryId },
      },
    })
  }

  return updated
}

export async function cancelPayRun(tx: any, payRunId: string, actorId: string) {
  const payRun = await tx.payRun.findUnique({ where: { id: payRunId } })
  if (!payRun) throw new Error('Pay run not found')
  if (!['draft', 'calculating', 'calculated', 'needs_attention', 'awaiting_approval'].includes(payRun.status)) {
    throw new Error('Only pay runs that have not been submitted can be cancelled')
  }
  if (payRun.providerPayrollId) {
    const provider = requireProvider()
    await provider.cancelPayroll(payRun.providerPayrollId)
  }
  const updated = await tx.payRun.update({ where: { id: payRun.id }, data: { status: 'cancelled' } })
  await tx.auditEvent.create({
    data: { organizationId: payRun.organizationId, actorId, action: 'pay_run.cancel', resourceType: 'pay_run', resourceId: payRun.id, newState: { status: 'cancelled' } },
  })
  return updated
}

export async function voidPayRun(tx: any, payRunId: string, actorId: string) {
  const payRun = await tx.payRun.findUnique({ where: { id: payRunId } })
  if (!payRun) throw new Error('Pay run not found')
  if (!['submitted', 'processing'].includes(payRun.status)) {
    throw new Error('Only submitted or processing pay runs can be voided')
  }
  const provider = requireProvider()
  if (payRun.providerPayrollId) await provider.voidPayroll(payRun.providerPayrollId)
  const updated = await tx.payRun.update({ where: { id: payRun.id }, data: { status: 'voided' } })
  await tx.auditEvent.create({
    data: { organizationId: payRun.organizationId, actorId, action: 'pay_run.void', resourceType: 'pay_run', resourceId: payRun.id, newState: { status: 'voided' } },
  })
  return updated
}

/**
 * Reverses a completed pay run: posts a mirror-image journal entry (every
 * debit/credit flipped) and creates a new PayRun record (offCycle,
 * status 'completed', reversalOfPayRunId pointing at the original, totals
 * negated) so reports and the general ledger both reflect the correction.
 * The original pay run is marked 'reversed'. Does not attempt to claw
 * back funds already paid out by the provider — that requires the
 * provider's own correction/off-cycle-deduction workflow once a real
 * provider is connected.
 */
export async function reversePayRun(tx: any, payRunId: string, actorId: string) {
  const original = await tx.payRun.findUnique({ where: { id: payRunId }, include: { lines: true } })
  if (!original) throw new Error('Pay run not found')
  if (original.status !== 'completed') throw new Error('Only completed pay runs can be reversed')
  if (!original.journalEntryId) throw new Error('Pay run has no journal entry to reverse')

  const existingReversal = await tx.payRun.findUnique({ where: { reversalOfPayRunId: payRunId } })
  if (existingReversal) throw new Error('This pay run has already been reversed')

  const originalEntry = await tx.journalEntry.findUnique({ where: { id: original.journalEntryId }, include: { lines: true } })
  if (!originalEntry) throw new Error('Original journal entry not found')

  const reversalLines = originalEntry.lines.map((l: any) => ({
    accountId: l.accountId,
    amount: l.amount.toString(),
    isDebit: !l.isDebit,
    description: l.description ? `Reversal: ${l.description}` : 'Payroll reversal',
  }))

  const reversalEntry = await postJournalEntryTx(
    tx,
    {
      organizationId: original.organizationId,
      description: `Reversal of pay run ${original.id}`,
      idempotencyKey: `pay-run:${original.id}:reversal`,
      lines: reversalLines,
    },
    actorId
  )

  const reversal = await tx.payRun.create({
    data: {
      organizationId: original.organizationId,
      payScheduleId: original.payScheduleId,
      payPeriodStart: original.payPeriodStart,
      payPeriodEnd: original.payPeriodEnd,
      offCycle: true,
      status: 'completed',
      totalGross: (-Number(original.totalGross)).toString(),
      totalEmployeeTax: (-Number(original.totalEmployeeTax)).toString(),
      totalEmployerTax: (-Number(original.totalEmployerTax)).toString(),
      totalPretaxDeductions: (-Number(original.totalPretaxDeductions)).toString(),
      totalPosttaxDeductions: (-Number(original.totalPosttaxDeductions)).toString(),
      totalGarnishments: (-Number(original.totalGarnishments)).toString(),
      totalReimbursements: (-Number(original.totalReimbursements)).toString(),
      totalEmployerBenefitsCost: (-Number(original.totalEmployerBenefitsCost)).toString(),
      totalNetPay: (-Number(original.totalNetPay)).toString(),
      reversalOfPayRunId: original.id,
      journalEntryId: reversalEntry.id,
      preparedByUserId: actorId,
      postedAt: new Date(),
    },
  })

  await tx.payRun.update({ where: { id: original.id }, data: { status: 'reversed' } })

  await tx.auditEvent.create({
    data: {
      organizationId: original.organizationId,
      actorId,
      action: 'pay_run.reverse',
      resourceType: 'pay_run',
      resourceId: original.id,
      newState: { reversalPayRunId: reversal.id },
    },
  })

  return reversal
}

