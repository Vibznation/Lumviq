/**
 * Sandbox (test-mode) implementation of PayrollProvider.
 *
 * THIS IS NOT A LICENSED PAYROLL PROVIDER. It exists purely so the
 * payroll-run workflow (src/lib/payroll-run.ts) and its API routes/UI can
 * be built and exercised end-to-end before a real provider (Check, Gusto
 * Embedded, etc.) is contracted and connected. The tax figures it returns
 * are deterministic simplified estimates (flat-rate approximations of
 * FICA/federal/state withholding) — they are NOT authoritative, do not
 * reflect real tax brackets/wage bases/jurisdiction rules, and must never
 * be presented to a user as real tax calculation, filed with any agency,
 * or used to actually pay anyone. See docs/known-limitations.md.
 *
 * Disabled by default: getPayrollProvider() only returns this instance
 * when PAYROLL_PROVIDER_MODE=sandbox is explicitly set (e.g. for local
 * development/testing). In every other environment payroll correctly
 * reports as "not connected", identical to the bank-feed/payments/ocr
 * stubs in this same directory.
 */
import { randomUUID, createHmac, createHash, timingSafeEqual } from 'crypto'
import type {
  PayrollProvider,
  PayrollCompanyInput,
  PayrollCompanyResult,
  PayrollWorkplaceInput,
  PayrollWorkplaceResult,
  PayrollEmployeeInput,
  PayrollEmployeeResult,
  PayrollContractorInput,
  PayrollContractorResult,
  PayrollBankAccountInput,
  PayrollBankAccountResult,
  PayrollTaxProfileInput,
  PayrollTaxProfileResult,
  PayrollScheduleInput,
  PayrollScheduleResult,
  PayrollCalculationRequest,
  PayrollCalculationResult,
  PayrollLineCalculationResult,
  PayrollSubmissionResult,
  PayrollPaystubResult,
  PayrollTaxLiability,
  PayrollTaxFilingStatus,
  PayrollTaxDocumentResult,
  PayrollWebhookEvent,
} from './payroll'
import { last4 } from '../encryption'

// Simplified, non-authoritative flat-rate sandbox estimates. Real
// federal/state withholding requires per-jurisdiction bracket tables and
// annual wage-base tracking that only a licensed provider can calculate
// correctly.
const SANDBOX_RATES = {
  socialSecurityEmployee: 0.062,
  socialSecurityEmployer: 0.062,
  medicareEmployee: 0.0145,
  medicareEmployer: 0.0145,
  federalWithholdingFlat: 0.12,
  stateWithholdingFlat: 0.04,
  futaEmployer: 0.006,
  sutaEmployer: 0.027,
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

interface SandboxPayrollRun {
  providerPayrollId: string
  status: PayrollSubmissionResult['status']
  result: PayrollCalculationResult
}

export class SandboxPayrollProvider implements PayrollProvider {
  readonly name = 'sandbox'
  // In-memory store — a real provider adapter would call out to the
  // provider's API instead. Fine for sandbox/dev-mode exercising of the
  // workflow; not durable across process restarts.
  private runs = new Map<string, SandboxPayrollRun>()
  private bankAccounts = new Map<string, { amounts: [string, string]; last4: string; verified: boolean }>()

  isConfigured(): boolean {
    return true
  }

  async createCompany(input: PayrollCompanyInput): Promise<PayrollCompanyResult> {
    return { externalId: `sandbox_co_${randomUUID()}`, status: 'verification_required' }
  }

  async updateCompany(externalId: string): Promise<PayrollCompanyResult> {
    return { externalId, status: 'verification_required' }
  }

  async verifyCompany(externalId: string): Promise<PayrollCompanyResult> {
    return { externalId, status: 'active' }
  }

  async createWorkplace(input: PayrollWorkplaceInput): Promise<PayrollWorkplaceResult> {
    return { externalId: `sandbox_wp_${randomUUID()}` }
  }

  async updateWorkplace(externalId: string): Promise<PayrollWorkplaceResult> {
    return { externalId }
  }

  async createEmployee(input: PayrollEmployeeInput): Promise<PayrollEmployeeResult> {
    return { externalId: `sandbox_emp_${randomUUID()}`, onboardingStatus: 'information_required' }
  }

  async updateEmployee(externalId: string): Promise<PayrollEmployeeResult> {
    return { externalId, onboardingStatus: 'ready' }
  }

  async onboardEmployee(externalId: string): Promise<PayrollEmployeeResult> {
    return { externalId, onboardingStatus: 'ready' }
  }

  async createContractor(input: PayrollContractorInput): Promise<PayrollContractorResult> {
    return { externalId: `sandbox_ctr_${randomUUID()}`, w9Status: 'pending' }
  }

  async configureBankAccount(input: PayrollBankAccountInput): Promise<PayrollBankAccountResult> {
    const externalId = `sandbox_bank_${randomUUID()}`
    // Deterministic two-cent micro-deposit simulation (like a real
    // provider's ACH trial-deposit verification, but instant and fake).
    const hash = createHash('sha256').update(input.accountNumber + input.routingNumber).digest()
    const amounts: [string, string] = [
      ((hash[0] % 49) + 1 + '').padStart(2, '0'),
      ((hash[1] % 49) + 1 + '').padStart(2, '0'),
    ].map((cents) => `0.${cents}`) as [string, string]
    const accountLast4 = last4(input.accountNumber)
    this.bankAccounts.set(externalId, { amounts, last4: accountLast4, verified: false })
    return {
      externalId,
      verificationStatus: 'pending',
      last4: accountLast4,
      sandboxMicroDepositAmounts: amounts,
    }
  }

  async verifyBankAccount(externalId: string, amounts: [string, string]): Promise<PayrollBankAccountResult> {
    const record = this.bankAccounts.get(externalId)
    if (!record) throw new Error(`Sandbox bank account not found: ${externalId}`)
    const matches = amounts[0] === record.amounts[0] && amounts[1] === record.amounts[1]
    record.verified = matches
    return {
      externalId,
      verificationStatus: matches ? 'verified' : 'failed',
      last4: record.last4,
    }
  }

  async configureTaxProfile(input: PayrollTaxProfileInput): Promise<PayrollTaxProfileResult> {
    return { externalId: `sandbox_tax_${randomUUID()}` }
  }

  async createPaySchedule(input: PayrollScheduleInput): Promise<PayrollScheduleResult> {
    return { externalId: `sandbox_sched_${randomUUID()}`, nextPayDate: input.anchorDate }
  }

  private calculate(request: PayrollCalculationRequest): PayrollCalculationResult {
    const lines: PayrollLineCalculationResult[] = []
    let totalGross = 0
    let totalEmployeeTax = 0
    let totalEmployerTax = 0
    let totalReimbursements = 0
    const warnings: string[] = []

    for (const line of request.lines) {
      const gross = Number(line.grossPay || 0)
      if (!(gross >= 0)) {
        warnings.push(`Employee ${line.employeeExternalId}: gross pay must be zero or positive`)
      }
      const reimbursements = Number(line.reimbursements || 0)
      const ssEmployee = gross * SANDBOX_RATES.socialSecurityEmployee
      const medicareEmployee = gross * SANDBOX_RATES.medicareEmployee
      const federal = gross * SANDBOX_RATES.federalWithholdingFlat
      const state = gross * SANDBOX_RATES.stateWithholdingFlat
      const employeeTax = ssEmployee + medicareEmployee + federal + state
      const ssEmployer = gross * SANDBOX_RATES.socialSecurityEmployer
      const medicareEmployer = gross * SANDBOX_RATES.medicareEmployer
      const futa = gross * SANDBOX_RATES.futaEmployer
      const suta = gross * SANDBOX_RATES.sutaEmployer
      const employerTax = ssEmployer + medicareEmployer + futa + suta
      const netPay = gross - employeeTax + reimbursements

      totalGross += gross
      totalEmployeeTax += employeeTax
      totalEmployerTax += employerTax
      totalReimbursements += reimbursements

      lines.push({
        employeeExternalId: line.employeeExternalId,
        grossPay: round2(gross),
        pretaxDeductions: '0.00',
        employeeTax: round2(employeeTax),
        posttaxDeductions: '0.00',
        garnishments: '0.00',
        reimbursements: round2(reimbursements),
        netPay: round2(netPay),
        employerTax: round2(employerTax),
        employerBenefitsCost: '0.00',
      })
    }

    const totalNetPay = totalGross - totalEmployeeTax + totalReimbursements

    return {
      providerPayrollId: `sandbox_run_${randomUUID()}`,
      status: warnings.length > 0 ? 'needs_attention' : 'calculated',
      totalGross: round2(totalGross),
      totalEmployeeTax: round2(totalEmployeeTax),
      totalEmployerTax: round2(totalEmployerTax),
      totalPretaxDeductions: '0.00',
      totalPosttaxDeductions: '0.00',
      totalReimbursements: round2(totalReimbursements),
      totalNetPay: round2(totalNetPay),
      debitDate: request.payPeriodEnd,
      employeePaymentDate: request.payPeriodEnd,
      lines,
      warnings,
    }
  }

  async calculatePayroll(request: PayrollCalculationRequest): Promise<PayrollCalculationResult> {
    const result = this.calculate(request)
    this.runs.set(result.providerPayrollId, { providerPayrollId: result.providerPayrollId, status: 'processing', result })
    return result
  }

  async previewPayroll(providerPayrollId: string): Promise<PayrollCalculationResult> {
    const run = this.runs.get(providerPayrollId)
    if (!run) throw new Error(`Sandbox payroll run not found: ${providerPayrollId}`)
    return run.result
  }

  async approvePayroll(providerPayrollId: string): Promise<PayrollSubmissionResult> {
    const run = this.runs.get(providerPayrollId)
    if (!run) throw new Error(`Sandbox payroll run not found: ${providerPayrollId}`)
    run.status = 'submitted'
    return { providerPayrollId, status: run.status }
  }

  async cancelPayroll(providerPayrollId: string): Promise<PayrollSubmissionResult> {
    const run = this.runs.get(providerPayrollId)
    if (!run) throw new Error(`Sandbox payroll run not found: ${providerPayrollId}`)
    run.status = 'failed'
    return { providerPayrollId, status: run.status }
  }

  async voidPayroll(providerPayrollId: string): Promise<PayrollSubmissionResult> {
    const run = this.runs.get(providerPayrollId)
    if (!run) throw new Error(`Sandbox payroll run not found: ${providerPayrollId}`)
    run.status = 'failed'
    return { providerPayrollId, status: run.status }
  }

  async createOffCyclePayroll(request: PayrollCalculationRequest): Promise<PayrollCalculationResult> {
    return this.calculatePayroll({ ...request, offCycle: true })
  }

  async retrievePayroll(providerPayrollId: string): Promise<PayrollSubmissionResult> {
    const run = this.runs.get(providerPayrollId)
    if (!run) throw new Error(`Sandbox payroll run not found: ${providerPayrollId}`)
    // Sandbox auto-progresses a submitted run to paid immediately, since
    // there is no real bank rail behind it.
    if (run.status === 'submitted' || run.status === 'processing') run.status = 'paid'
    return { providerPayrollId, status: run.status }
  }

  async retrievePaystub(providerPayrollId: string, employeeExternalId: string): Promise<PayrollPaystubResult> {
    const run = this.runs.get(providerPayrollId)
    if (!run) throw new Error(`Sandbox payroll run not found: ${providerPayrollId}`)
    const line = run.result.lines.find((l) => l.employeeExternalId === employeeExternalId)
    if (!line) throw new Error(`No line for employee ${employeeExternalId} on payroll ${providerPayrollId}`)
    return { employeeExternalId, lines: line }
  }

  async retrieveTaxLiabilities(companyExternalId: string): Promise<PayrollTaxLiability[]> {
    // Deterministic simulation: derive a small set of outstanding
    // liabilities from completed/paid sandbox runs so the tax center has
    // something real to reconcile against in test mode.
    const liabilities: PayrollTaxLiability[] = []
    for (const run of this.runs.values()) {
      if (run.status !== 'paid' && run.status !== 'completed') continue
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 15)
      liabilities.push({
        jurisdiction: 'federal',
        formType: '941',
        amount: round2(Number(run.result.totalEmployeeTax) + Number(run.result.totalEmployerTax)),
        dueDate: dueDate.toISOString(),
      })
    }
    return liabilities
  }

  async retrieveTaxFilings(companyExternalId: string): Promise<PayrollTaxFilingStatus[]> {
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, 0)
    if (this.runs.size === 0) return []
    return [
      {
        jurisdiction: 'federal',
        formType: '941',
        filingPeriodStart: periodStart.toISOString(),
        filingPeriodEnd: periodEnd.toISOString(),
        status: 'pending',
      },
    ]
  }

  async retrieveTaxDocuments(companyExternalId: string, taxYear: number): Promise<PayrollTaxDocumentResult[]> {
    // Sandbox documents are only ever marked 'pending' — a real provider
    // generates and delivers the actual W-2/1099 PDFs at year end.
    const documents: PayrollTaxDocumentResult[] = []
    const seen = new Set<string>()
    for (const run of this.runs.values()) {
      for (const line of run.result.lines) {
        if (seen.has(line.employeeExternalId)) continue
        seen.add(line.employeeExternalId)
        documents.push({
          ownerExternalId: line.employeeExternalId,
          documentType: 'w2',
          taxYear,
          status: 'pending',
        })
      }
    }
    return documents
  }

  async retrievePaymentStatus(providerPayrollId: string): Promise<PayrollSubmissionResult> {
    return this.retrievePayroll(providerPayrollId)
  }

  handleWebhook(rawBody: string, signatureHeader: string | undefined): PayrollWebhookEvent {
    const secret = process.env.PAYROLL_WEBHOOK_SECRET || 'sandbox-webhook-secret'
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
    const provided = signatureHeader || ''
    const expectedBuf = Buffer.from(expected, 'hex')
    const providedBuf = Buffer.from(provided, 'hex')
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw new Error('Invalid payroll webhook signature')
    }
    const payload = JSON.parse(rawBody)
    return {
      externalEventId: payload.id || randomUUID(),
      eventType: payload.type || 'unknown',
      payload,
    }
  }
}

let sandboxInstance: SandboxPayrollProvider | undefined

/**
 * Returns the active PayrollProvider, or undefined if none is connected.
 * Mirrors the "not connected until an adapter is registered" convention
 * used by bank-feed/payments/ocr. Only returns the sandbox implementation
 * when explicitly opted into via PAYROLL_PROVIDER_MODE=sandbox — never
 * enabled implicitly in production.
 */
export function getPayrollProvider(): PayrollProvider | undefined {
  if (process.env.PAYROLL_PROVIDER_MODE === 'sandbox') {
    if (!sandboxInstance) sandboxInstance = new SandboxPayrollProvider()
    return sandboxInstance
  }
  return undefined
}
