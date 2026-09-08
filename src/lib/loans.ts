/**
 * Loan/debt amortization. Standard amortizing-loan formula (equal total
 * payment, split between interest and principal each period based on the
 * remaining balance). Interest compounds monthly at
 * interestRatePercent / 12.
 *
 * Posting matrix:
 *   Disbursement       -> Debit Cash/Bank, Credit Loan Liability (recorded once at creation if disbursementAccountId set)
 *   Monthly payment    -> Debit Loan Liability (principal) + Debit Interest Expense (interest), Credit Cash/Bank
 */

/** Computes the fixed monthly payment amount for a standard amortizing loan. */
export function monthlyPaymentAmount(principal: number, annualRatePercent: number, termMonths: number): number {
  const monthlyRate = annualRatePercent / 100 / 12
  if (monthlyRate === 0) return Math.round((principal / termMonths) * 100) / 100
  const payment = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))
  return Math.round(payment * 100) / 100
}

export interface AmortizationRow {
  paymentDate: Date
  payment: number
  principalPortion: number
  interestPortion: number
  remainingBalance: number
}

/** Generates the full amortization schedule (preview only, does not touch the DB). */
export function generateAmortizationSchedule(params: { principal: number; interestRatePercent: number; termMonths: number; startDate: Date }): AmortizationRow[] {
  const { principal, interestRatePercent, termMonths, startDate } = params
  const payment = monthlyPaymentAmount(principal, interestRatePercent, termMonths)
  const monthlyRate = interestRatePercent / 100 / 12
  let balance = principal
  const rows: AmortizationRow[] = []
  for (let i = 0; i < termMonths; i++) {
    const interestPortion = Math.round(balance * monthlyRate * 100) / 100
    let principalPortion = Math.round((payment - interestPortion) * 100) / 100
    if (i === termMonths - 1) principalPortion = balance // last payment clears remaining balance exactly
    balance = Math.round((balance - principalPortion) * 100) / 100
    const paymentDate = new Date(startDate)
    paymentDate.setMonth(paymentDate.getMonth() + i + 1)
    rows.push({ paymentDate, payment: Math.round((principalPortion + interestPortion) * 100) / 100, principalPortion, interestPortion, remainingBalance: balance })
  }
  return rows
}

/**
 * Posts the next scheduled loan payment (the first payment whose date has
 * no LoanPayment row yet). Idempotent per (loanId, paymentDate).
 */
export async function postNextLoanPayment(tx: any, loanId: string, actorId: string, paymentAccountId: string) {
  const loan = await tx.loan.findUnique({ where: { id: loanId } })
  if (!loan) throw new Error('Loan not found')

  const schedule = generateAmortizationSchedule({
    principal: Number(loan.principal),
    interestRatePercent: Number(loan.interestRatePercent),
    termMonths: loan.termMonths,
    startDate: loan.startDate,
  })
  const existingPayments = await tx.loanPayment.findMany({ where: { loanId }, orderBy: { paymentDate: 'asc' } })
  const nextIndex = existingPayments.length
  if (nextIndex >= schedule.length) return null // loan fully paid off

  const row = schedule[nextIndex]
  const idempotencyKey = `loan:${loanId}:payment:${row.paymentDate.toISOString().slice(0, 10)}`

  const entry = await tx.journalEntry.create({
    data: {
      organizationId: loan.organizationId,
      description: `Loan payment - ${loan.name}`,
      posted: true,
      postedAt: row.paymentDate,
      idempotencyKey,
      lines: {
        create: [
          { accountId: loan.liabilityAccountId, amount: row.principalPortion.toString(), isDebit: true, description: `Principal - ${loan.name}` },
          { accountId: loan.interestExpenseAccountId, amount: row.interestPortion.toString(), isDebit: true, description: `Interest - ${loan.name}` },
          { accountId: paymentAccountId, amount: row.payment.toString(), isDebit: false, description: `Loan payment - ${loan.name}` },
        ],
      },
    },
  })

  await tx.auditEvent.create({
    data: { organizationId: loan.organizationId, actorId, action: 'loan.payment', resourceType: 'loan', resourceId: loan.id, newState: { journalEntryId: entry.id, ...row } },
  })

  return tx.loanPayment.create({
    data: {
      loanId,
      paymentDate: row.paymentDate,
      amount: row.payment.toString(),
      principalPortion: row.principalPortion.toString(),
      interestPortion: row.interestPortion.toString(),
      journalEntryId: entry.id,
    },
  })
}
