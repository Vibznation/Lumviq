/**
 * Domain logic for payroll ledger posting only.
 *
 * IMPORTANT SCOPE LIMITATION: Lumviq does not calculate tax withholding,
 * file payroll tax returns, or perform direct deposit. Run payroll with a
 * licensed payroll provider (e.g. Gusto, ADP, QuickBooks Payroll), then
 * enter the resulting totals here — gross pay, each employee's tax
 * withholding, and the employer's payroll tax expense — so Lumviq can
 * record the accounting impact:
 *
 *   - Payroll Expense: total gross wages
 *   - Payroll Tax Expense: employer's share of payroll taxes (if any)
 *   - Payroll Liabilities: net pay owed to employees until paid out
 *   - Payroll Taxes Payable: employee withholding + employer taxes owed
 *     to tax agencies until remitted (if any)
 *
 * Posting matrix:
 *   Pay run posted ->
 *     Debit  Payroll Expense           totalGross
 *     Debit  Payroll Tax Expense       totalEmployerTax (only if > 0)
 *     Credit Payroll Liabilities       totalNetPay (= totalGross - totalEmployeeTax)
 *     Credit Payroll Taxes Payable     totalEmployeeTax + totalEmployerTax (only if > 0)
 */

import { addMinor, fromMinorUnits, toMinorUnits } from './money'

export async function findPayrollAccounts(tx: any, organizationId: string) {
  const [expense, liability, taxExpense, taxLiability] = await Promise.all([
    tx.account.findFirst({ where: { organizationId, subtype: 'payroll_expense' } }),
    tx.account.findFirst({ where: { organizationId, subtype: 'payroll_liability' } }),
    tx.account.findFirst({ where: { organizationId, subtype: 'payroll_tax_expense' } }),
    tx.account.findFirst({ where: { organizationId, subtype: 'payroll_tax_liability' } }),
  ])
  if (!expense || !liability) {
    throw new Error('Payroll Expense and Payroll Liabilities accounts must be configured for this organization')
  }
  return { expense, liability, taxExpense, taxLiability }
}

/**
 * Posts a pay run to the ledger. Idempotent: if the pay run already has a
 * journalEntryId, the existing entry is returned unchanged.
 */
export async function postPayRunToLedger(tx: any, payRun: any, actorId: string) {
  if (payRun.journalEntryId) {
    return tx.journalEntry.findUnique({ where: { id: payRun.journalEntryId }, include: { lines: true } })
  }

  const { expense, liability, taxExpense, taxLiability } = await findPayrollAccounts(tx, payRun.organizationId)
  const idempotencyKey = `pay-run:${payRun.id}:post`

  const grossMinor = toMinorUnits(payRun.totalGross.toString())
  const employeeTaxMinor = toMinorUnits(payRun.totalEmployeeTax?.toString() ?? '0')
  const employerTaxMinor = toMinorUnits(payRun.totalEmployerTax?.toString() ?? '0')
  const netPayMinor = grossMinor - employeeTaxMinor
  const taxPayableMinor = addMinor(employeeTaxMinor, employerTaxMinor)

  if (employerTaxMinor > BigInt(0) && !taxExpense) {
    throw new Error('A Payroll Tax Expense account must be configured to record employer payroll taxes')
  }
  if (taxPayableMinor > BigInt(0) && !taxLiability) {
    throw new Error('A Payroll Taxes Payable account must be configured to record tax withholding/employer taxes owed')
  }

  const lines: any[] = [
    { accountId: expense.id, amount: payRun.totalGross, isDebit: true, description: 'Gross payroll expense' },
  ]
  if (employerTaxMinor > BigInt(0)) {
    lines.push({ accountId: taxExpense.id, amount: fromMinorUnits(employerTaxMinor), isDebit: true, description: 'Employer payroll tax expense' })
  }
  lines.push({ accountId: liability.id, amount: fromMinorUnits(netPayMinor), isDebit: false, description: 'Net pay owed to employees' })
  if (taxPayableMinor > BigInt(0)) {
    lines.push({ accountId: taxLiability.id, amount: fromMinorUnits(taxPayableMinor), isDebit: false, description: 'Payroll taxes payable' })
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
