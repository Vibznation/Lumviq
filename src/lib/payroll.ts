/**
 * Domain logic for payroll ledger posting.
 *
 * IMPORTANT SCOPE LIMITATION: Lumviq itself does not calculate tax
 * withholding, file payroll tax returns, or move money. Amounts posted
 * here come either from manual entry of a licensed payroll provider's
 * totals, or — once a provider is connected (see
 * src/lib/integrations/payroll.ts, src/lib/payroll-run.ts) — from that
 * provider's calculation. Lumviq only records the resulting accounting
 * impact:
 *
 *   - Payroll Expense: total gross wages
 *   - Payroll Tax Expense: employer's share of payroll taxes (if any)
 *   - Employer Benefits Expense: employer's cost of benefits (if any)
 *   - Reimbursement Expense: employee reimbursements paid via payroll (if any)
 *   - Payroll Liabilities: net pay owed to employees until paid out
 *   - Payroll Taxes Payable: employee withholding + employer taxes owed
 *     to tax agencies until remitted (if any)
 *   - Payroll Deductions Payable: pretax/posttax deductions withheld and
 *     owed to benefit providers (if any)
 *   - Garnishments Payable: wage garnishments withheld and owed to the
 *     issuing agency/creditor (if any)
 *   - Employer Benefits Payable: employer's benefits cost owed to the
 *     benefits provider (if any)
 *
 * Posting matrix:
 *   Pay run posted ->
 *     Debit  Payroll Expense            totalGross
 *     Debit  Payroll Tax Expense        totalEmployerTax (only if > 0)
 *     Debit  Employer Benefits Expense  totalEmployerBenefitsCost (only if > 0)
 *     Debit  Reimbursement Expense      totalReimbursements (only if > 0)
 *     Credit Payroll Liabilities        totalNetPay
 *     Credit Payroll Taxes Payable      totalEmployeeTax + totalEmployerTax (only if > 0)
 *     Credit Payroll Deductions Payable totalPretaxDeductions + totalPosttaxDeductions (only if > 0)
 *     Credit Garnishments Payable       totalGarnishments (only if > 0)
 *     Credit Employer Benefits Payable  totalEmployerBenefitsCost (only if > 0)
 *   where totalNetPay = totalGross - totalEmployeeTax - totalPretaxDeductions
 *                        - totalPosttaxDeductions - totalGarnishments + totalReimbursements
 */

import { addMinor, fromMinorUnits, toMinorUnits } from './money'

export async function findPayrollAccounts(tx: any, organizationId: string) {
  const [expense, liability, taxExpense, taxLiability, deductionsLiability, garnishmentsPayable, benefitsExpense, benefitsPayable, reimbursementExpense] =
    await Promise.all([
      tx.account.findFirst({ where: { organizationId, subtype: 'payroll_expense' } }),
      tx.account.findFirst({ where: { organizationId, subtype: 'payroll_liability' } }),
      tx.account.findFirst({ where: { organizationId, subtype: 'payroll_tax_expense' } }),
      tx.account.findFirst({ where: { organizationId, subtype: 'payroll_tax_liability' } }),
      tx.account.findFirst({ where: { organizationId, subtype: 'payroll_deductions_liability' } }),
      tx.account.findFirst({ where: { organizationId, subtype: 'garnishments_payable' } }),
      tx.account.findFirst({ where: { organizationId, subtype: 'employer_benefits_expense' } }),
      tx.account.findFirst({ where: { organizationId, subtype: 'employer_benefits_payable' } }),
      tx.account.findFirst({ where: { organizationId, subtype: 'reimbursement_expense' } }),
    ])
  if (!expense || !liability) {
    throw new Error('Payroll Expense and Payroll Liabilities accounts must be configured for this organization')
  }
  return { expense, liability, taxExpense, taxLiability, deductionsLiability, garnishmentsPayable, benefitsExpense, benefitsPayable, reimbursementExpense }
}

/**
 * Posts a pay run to the ledger. Idempotent: if the pay run already has a
 * journalEntryId, the existing entry is returned unchanged.
 */
export async function postPayRunToLedger(tx: any, payRun: any, actorId: string) {
  if (payRun.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: payRun.journalEntryId }, include: { lines: true } })
  }

  const { expense, liability, taxExpense, taxLiability, deductionsLiability, garnishmentsPayable, benefitsExpense, benefitsPayable, reimbursementExpense } =
    await findPayrollAccounts(tx, payRun.organizationId)
  const idempotencyKey = `pay-run:${payRun.id}:post`

  const grossMinor = toMinorUnits(payRun.totalGross.toString())
  const employeeTaxMinor = toMinorUnits(payRun.totalEmployeeTax?.toString() ?? '0')
  const employerTaxMinor = toMinorUnits(payRun.totalEmployerTax?.toString() ?? '0')
  const pretaxMinor = toMinorUnits(payRun.totalPretaxDeductions?.toString() ?? '0')
  const posttaxMinor = toMinorUnits(payRun.totalPosttaxDeductions?.toString() ?? '0')
  const garnishMinor = toMinorUnits(payRun.totalGarnishments?.toString() ?? '0')
  const reimbursementMinor = toMinorUnits(payRun.totalReimbursements?.toString() ?? '0')
  const benefitsCostMinor = toMinorUnits(payRun.totalEmployerBenefitsCost?.toString() ?? '0')

  const deductionsMinor = addMinor(pretaxMinor, posttaxMinor)
  const taxPayableMinor = addMinor(employeeTaxMinor, employerTaxMinor)
  const netPayMinor = grossMinor - employeeTaxMinor - deductionsMinor - garnishMinor + reimbursementMinor

  if (employerTaxMinor > BigInt(0) && !taxExpense) {
    throw new Error('A Payroll Tax Expense account must be configured to record employer payroll taxes')
  }
  if (taxPayableMinor > BigInt(0) && !taxLiability) {
    throw new Error('A Payroll Taxes Payable account must be configured to record tax withholding/employer taxes owed')
  }
  if (deductionsMinor > BigInt(0) && !deductionsLiability) {
    throw new Error('A Payroll Deductions Payable account must be configured to record withheld deductions')
  }
  if (garnishMinor > BigInt(0) && !garnishmentsPayable) {
    throw new Error('A Garnishments Payable account must be configured to record withheld garnishments')
  }
  if (benefitsCostMinor > BigInt(0) && (!benefitsExpense || !benefitsPayable)) {
    throw new Error('Employer Benefits Expense and Employer Benefits Payable accounts must be configured to record employer benefits cost')
  }
  if (reimbursementMinor > BigInt(0) && !reimbursementExpense) {
    throw new Error('A Reimbursement Expense account must be configured to record payroll reimbursements')
  }

  const lines: any[] = [
    { accountId: expense.id, amount: payRun.totalGross, isDebit: true, description: 'Gross payroll expense' },
  ]
  if (employerTaxMinor > BigInt(0)) {
    lines.push({ accountId: taxExpense.id, amount: fromMinorUnits(employerTaxMinor), isDebit: true, description: 'Employer payroll tax expense' })
  }
  if (benefitsCostMinor > BigInt(0)) {
    lines.push({ accountId: benefitsExpense.id, amount: fromMinorUnits(benefitsCostMinor), isDebit: true, description: 'Employer benefits expense' })
  }
  if (reimbursementMinor > BigInt(0)) {
    lines.push({ accountId: reimbursementExpense.id, amount: fromMinorUnits(reimbursementMinor), isDebit: true, description: 'Payroll reimbursements' })
  }
  lines.push({ accountId: liability.id, amount: fromMinorUnits(netPayMinor), isDebit: false, description: 'Net pay owed to employees' })
  if (taxPayableMinor > BigInt(0)) {
    lines.push({ accountId: taxLiability.id, amount: fromMinorUnits(taxPayableMinor), isDebit: false, description: 'Payroll taxes payable' })
  }
  if (deductionsMinor > BigInt(0)) {
    lines.push({ accountId: deductionsLiability.id, amount: fromMinorUnits(deductionsMinor), isDebit: false, description: 'Payroll deductions payable' })
  }
  if (garnishMinor > BigInt(0)) {
    lines.push({ accountId: garnishmentsPayable.id, amount: fromMinorUnits(garnishMinor), isDebit: false, description: 'Garnishments payable' })
  }
  if (benefitsCostMinor > BigInt(0)) {
    lines.push({ accountId: benefitsPayable.id, amount: fromMinorUnits(benefitsCostMinor), isDebit: false, description: 'Employer benefits payable' })
  }

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: payRun.organizationId,
      description: `Pay run ${payRun.payPeriodStart.toISOString().slice(0, 10)} – ${payRun.payPeriodEnd.toISOString().slice(0, 10)}`,
      posted: true,
      postedAt: new Date(),
      idempotencyKey,
      lines: { create: lines },
    },
    include: { lines: true },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: payRun.organizationId,
      actorId,
      action: 'pay_run.post',
      resourceType: 'pay_run',
      resourceId: payRun.id,
      newState: { journalEntryId: entry.id },
    },
  })

  return entry
}

