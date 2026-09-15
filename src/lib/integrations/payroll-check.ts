/**
 * Real embedded-payroll provider adapter for Check (https://checkhq.com).
 *
 * This is a genuine HTTP-calling implementation of the `PayrollProvider`
 * interface (payroll.ts) — not a mock. It requires a real Check API key
 * to do anything: `isConfigured()` returns false and `getPayrollProvider()`
 * (payroll-sandbox.ts) never selects this adapter unless `CHECK_API_KEY`
 * is set, so nothing here can activate silently or by accident.
 *
 * IMPORTANT — verify before production use:
 *   Endpoint paths, payload shapes, and status-value names below follow
 *   Check's publicly documented REST API conventions (bearer-token auth,
 *   `/companies`, `/employees`, `/contractors`, `/workplaces`,
 *   `/individuals`, `/payrolls`, `/contractor_payments`, `/pay_schedules`,
 *   webhook payloads signed via an HMAC header) as of when this adapter
 *   was written. Check's API can change, and this adapter has not been
 *   exercised against a live Check account. Before enabling
 *   `PAYROLL_PROVIDER_MODE=check` in production:
 *     1. Confirm every endpoint path/payload against Check's current API
 *        reference (https://docs.checkhq.com) for your contracted API
 *        version.
 *     2. Confirm you have a signed partner/reseller agreement with Check
 *        authorizing embedded payroll (payroll is a regulated activity —
 *        see docs/integration-adapters.md).
 *     3. Run the sandbox test suite (tests/payroll-full-sandbox.test.ts,
 *        etc.) against Check's own sandbox environment, not just
 *        Lumviq's in-memory SandboxPayrollProvider.
 *
 * Lumviq never claims payroll is "operational" based on this file
 * existing — only a real connected+verified provider, confirmed via
 * `GET /api/integrations/payroll-status`, makes that true.
 */
import { createHmac, timingSafeEqual } from 'crypto'
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
  PayrollSubmissionResult,
  PayrollPaystubResult,
  PayrollTaxLiability,
  PayrollTaxFilingStatus,
  PayrollTaxDocumentResult,
  PayrollWebhookEvent,
} from './payroll'

const DEFAULT_BASE_URL = 'https://sandbox.checkhq.com'

export class PayrollProviderApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'PayrollProviderApiError'
    this.status = status
    this.body = body
  }
}

export class CheckPayrollProvider implements PayrollProvider {
  readonly name = 'check'
  private apiKey: string | undefined
  private baseUrl: string
  private webhookSecret: string | undefined

  constructor() {
    this.apiKey = process.env.CHECK_API_KEY
    this.baseUrl = process.env.CHECK_API_BASE_URL || DEFAULT_BASE_URL
    this.webhookSecret = process.env.CHECK_WEBHOOK_SECRET
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey)
  }

  /** Shared authenticated JSON request helper with basic retry-on-5xx (transient failures only; never retries on 4xx). */
  private async request(method: string, path: string, body?: unknown, attempt = 1): Promise<any> {
    if (!this.apiKey) throw new Error('CHECK_API_KEY is not configured')
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (res.status >= 500 && attempt < 3) {
      // Transient provider-side failure: retry with a short linear backoff (not applicable to 4xx — those are our request's fault).
      await new Promise((r) => setTimeout(r, 250 * attempt))
      return this.request(method, path, body, attempt + 1)
    }

    const text = await res.text()
    const json = text ? JSON.parse(text) : undefined
    if (!res.ok) {
      throw new PayrollProviderApiError(res.status, (json && (json.message || json.error)) || `Check API request failed (${res.status})`, json)
    }
    return json
  }

  async createCompany(input: PayrollCompanyInput): Promise<PayrollCompanyResult> {
    const json = await this.request('POST', '/companies', {
      legal_name: input.legalName,
      ein: input.ein,
      primary_address: {
        line1: input.address.line1,
        line2: input.address.line2,
        city: input.address.city,
        state: input.address.state,
        postal_code: input.address.postalCode,
        country: 'US',
      },
    })
    return { externalId: json.id, status: mapCompanyStatus(json.onboard?.status ?? json.status) }
  }

  async updateCompany(externalId: string, input: Partial<PayrollCompanyInput>): Promise<PayrollCompanyResult> {
    const json = await this.request('PATCH', `/companies/${externalId}`, {
      legal_name: input.legalName,
      ein: input.ein,
      ...(input.address
        ? {
            primary_address: {
              line1: input.address.line1,
              line2: input.address.line2,
              city: input.address.city,
              state: input.address.state,
              postal_code: input.address.postalCode,
              country: 'US',
            },
          }
        : {}),
    })
    return { externalId: json.id, status: mapCompanyStatus(json.onboard?.status ?? json.status) }
  }

  async verifyCompany(externalId: string): Promise<PayrollCompanyResult> {
    const json = await this.request('GET', `/companies/${externalId}`)
    return { externalId: json.id, status: mapCompanyStatus(json.onboard?.status ?? json.status) }
  }

  async createWorkplace(input: PayrollWorkplaceInput): Promise<PayrollWorkplaceResult> {
    const json = await this.request('POST', '/workplaces', {
      company: input.companyExternalId,
      name: input.name,
      address: {
        line1: input.address.line1,
        line2: input.address.line2,
        city: input.address.city,
        state: input.address.state,
        postal_code: input.address.postalCode,
        country: 'US',
      },
    })
    return { externalId: json.id }
  }

  async updateWorkplace(externalId: string, input: Partial<PayrollWorkplaceInput>): Promise<PayrollWorkplaceResult> {
    const json = await this.request('PATCH', `/workplaces/${externalId}`, {
      name: input.name,
      ...(input.address
        ? {
            address: {
              line1: input.address.line1,
              line2: input.address.line2,
              city: input.address.city,
              state: input.address.state,
              postal_code: input.address.postalCode,
              country: 'US',
            },
          }
        : {}),
    })
    return { externalId: json.id }
  }

  async createEmployee(input: PayrollEmployeeInput): Promise<PayrollEmployeeResult> {
    const json = await this.request('POST', '/employees', {
      company: input.companyExternalId,
      workplace: input.workplaceExternalId,
      individual: {
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
        ssn: input.ssn,
        dob: input.dateOfBirth,
        ...(input.address
          ? {
              residence: {
                line1: input.address.line1,
                line2: input.address.line2,
                city: input.address.city,
                state: input.address.state,
                postal_code: input.address.postalCode,
                country: 'US',
              },
            }
          : {}),
      },
      compensation_amount: input.rate,
      compensation_unit: input.payType === 'hourly' ? 'hour' : 'year',
    })
    return { externalId: json.id, onboardingStatus: mapEmployeeOnboardingStatus(json.onboard?.status) }
  }

  async updateEmployee(externalId: string, input: Partial<PayrollEmployeeInput>): Promise<PayrollEmployeeResult> {
    const json = await this.request('PATCH', `/employees/${externalId}`, {
      ...(input.rate ? { compensation_amount: input.rate } : {}),
      ...(input.payType ? { compensation_unit: input.payType === 'hourly' ? 'hour' : 'year' } : {}),
    })
    return { externalId: json.id, onboardingStatus: mapEmployeeOnboardingStatus(json.onboard?.status) }
  }

  async onboardEmployee(externalId: string): Promise<PayrollEmployeeResult> {
    const json = await this.request('GET', `/employees/${externalId}`)
    return { externalId: json.id, onboardingStatus: mapEmployeeOnboardingStatus(json.onboard?.status) }
  }

  async createContractor(input: PayrollContractorInput): Promise<PayrollContractorResult> {
    const json = await this.request('POST', '/contractors', {
      company: input.companyExternalId,
      type: input.businessName ? 'business' : 'individual',
      business_name: input.businessName,
      tax_id: input.taxId,
      tax_classification: input.taxClassification,
      individual: input.businessName ? undefined : { name: input.name, email: input.email },
      email: input.email,
    })
    return { externalId: json.id, w9Status: mapW9Status(json.onboard?.status ?? json.w9_status) }
  }

  async configureBankAccount(input: PayrollBankAccountInput): Promise<PayrollBankAccountResult> {
    const json = await this.request('POST', '/bank_accounts', {
      account_holder: input.ownerExternalId,
      routing_number: input.routingNumber,
      account_number: input.accountNumber,
      account_type: input.accountType,
    })
    return {
      externalId: json.id,
      verificationStatus: mapBankVerificationStatus(json.verification_status ?? json.status),
      last4: (input.accountNumber || '').slice(-4),
    }
  }

  async verifyBankAccount(externalId: string, amounts: [string, string]): Promise<PayrollBankAccountResult> {
    const json = await this.request('POST', `/bank_accounts/${externalId}/verify`, {
      amounts: amounts.map((a) => Math.round(Number(a) * 100)),
    })
    return {
      externalId: json.id ?? externalId,
      verificationStatus: mapBankVerificationStatus(json.verification_status ?? json.status),
      last4: json.account_number_last4 ?? '',
    }
  }

  async configureTaxProfile(input: PayrollTaxProfileInput): Promise<PayrollTaxProfileResult> {
    const json = await this.request('PATCH', `/employees/${input.employeeExternalId}/tax_profile`, {
      filing_status: input.filingStatus,
      federal_allowances: input.federalAllowances,
      federal_extra_withholding: input.federalExtraWithholding,
      state: input.state,
      state_allowances: input.stateAllowances,
      state_extra_withholding: input.stateExtraWithholding,
      exempt_from_federal_withholding: input.exemptFromFederal,
      exempt_from_state_withholding: input.exemptFromState,
    })
    return { externalId: json.id ?? input.employeeExternalId }
  }

  async createPaySchedule(input: PayrollScheduleInput): Promise<PayrollScheduleResult> {
    const json = await this.request('POST', '/pay_schedules', {
      company: input.companyExternalId,
      frequency: input.frequency,
      anchor_pay_date: input.anchorDate,
    })
    return { externalId: json.id, nextPayDate: json.next_pay_date ?? input.anchorDate }
  }

  async calculatePayroll(request: PayrollCalculationRequest): Promise<PayrollCalculationResult> {
    const json = await this.request('POST', '/payrolls', {
      company: request.companyExternalId,
      period_start: request.payPeriodStart,
      period_end: request.payPeriodEnd,
      off_cycle: request.offCycle ?? false,
      items: request.lines.map((l) => ({
        employee: l.employeeExternalId,
        hours: l.regularHours,
        overtime_hours: l.overtimeHours,
        earnings: l.grossPay ? [{ type: 'regular', amount: l.grossPay }] : undefined,
        reimbursements: l.reimbursements ? [{ amount: l.reimbursements }] : undefined,
      })),
    })
    return mapCalculationResult(json)
  }

  async previewPayroll(providerPayrollId: string): Promise<PayrollCalculationResult> {
    const json = await this.request('GET', `/payrolls/${providerPayrollId}`)
    return mapCalculationResult(json)
  }

  async approvePayroll(providerPayrollId: string): Promise<PayrollSubmissionResult> {
    const json = await this.request('POST', `/payrolls/${providerPayrollId}/approve`)
    return { providerPayrollId, status: mapSubmissionStatus(json.status) }
  }

  async cancelPayroll(providerPayrollId: string): Promise<PayrollSubmissionResult> {
    const json = await this.request('POST', `/payrolls/${providerPayrollId}/cancel`)
    return { providerPayrollId, status: mapSubmissionStatus(json.status) }
  }

  async voidPayroll(providerPayrollId: string): Promise<PayrollSubmissionResult> {
    const json = await this.request('POST', `/payrolls/${providerPayrollId}/void`)
    return { providerPayrollId, status: mapSubmissionStatus(json.status) }
  }

  async createOffCyclePayroll(request: PayrollCalculationRequest): Promise<PayrollCalculationResult> {
    return this.calculatePayroll({ ...request, offCycle: true })
  }

  async retrievePayroll(providerPayrollId: string): Promise<PayrollSubmissionResult> {
    const json = await this.request('GET', `/payrolls/${providerPayrollId}`)
    return { providerPayrollId, status: mapSubmissionStatus(json.status) }
  }

  async retrievePaystub(providerPayrollId: string, employeeExternalId: string): Promise<PayrollPaystubResult> {
    const json = await this.request('GET', `/payrolls/${providerPayrollId}/pay_stubs/${employeeExternalId}`)
    return {
      employeeExternalId,
      pdfUrl: json.pdf_url,
      lines: mapLineResult(json),
    }
  }

  async retrieveTaxLiabilities(companyExternalId: string): Promise<PayrollTaxLiability[]> {
    const json = await this.request('GET', `/companies/${companyExternalId}/tax_liabilities`)
    const items = Array.isArray(json) ? json : json.items ?? []
    return items.map((i: any) => ({
      jurisdiction: i.jurisdiction,
      formType: i.form_type,
      amount: i.amount,
      dueDate: i.due_date,
    }))
  }

  async retrieveTaxFilings(companyExternalId: string): Promise<PayrollTaxFilingStatus[]> {
    const json = await this.request('GET', `/companies/${companyExternalId}/tax_filings`)
    const items = Array.isArray(json) ? json : json.items ?? []
    return items.map((i: any) => ({
      jurisdiction: i.jurisdiction,
      formType: i.form_type,
      filingPeriodStart: i.period_start,
      filingPeriodEnd: i.period_end,
      status: i.status,
      confirmationId: i.confirmation_id,
    }))
  }

  async retrieveTaxDocuments(companyExternalId: string, taxYear: number): Promise<PayrollTaxDocumentResult[]> {
    const json = await this.request('GET', `/companies/${companyExternalId}/tax_documents?year=${taxYear}`)
    const items = Array.isArray(json) ? json : json.items ?? []
    return items.map((i: any) => ({
      ownerExternalId: i.owner,
      documentType: i.document_type,
      taxYear,
      status: i.status,
      pdfUrl: i.pdf_url,
    }))
  }

  async retrievePaymentStatus(providerPayrollId: string): Promise<PayrollSubmissionResult> {
    return this.retrievePayroll(providerPayrollId)
  }

  /**
   * Verifies an inbound Check webhook using an HMAC-SHA256 signature
   * (constant-time compare). Header name/format must be confirmed
   * against Check's current webhook documentation before production use.
   */
  handleWebhook(rawBody: string, signatureHeader: string | undefined): PayrollWebhookEvent {
    if (!this.webhookSecret) throw new Error('CHECK_WEBHOOK_SECRET is not configured')
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex')
    const provided = signatureHeader || ''
    const expectedBuf = Buffer.from(expected, 'hex')
    const providedBuf = Buffer.from(provided, 'hex')
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw new Error('Invalid payroll webhook signature')
    }
    const payload = JSON.parse(rawBody)
    return {
      externalEventId: payload.id,
      eventType: payload.type,
      payload,
    }
  }
}

function mapCompanyStatus(status: string | undefined): PayrollCompanyResult['status'] {
  switch (status) {
    case 'onboarding_completed':
    case 'active':
      return 'active'
    case 'blocking':
    case 'suspended':
      return 'suspended'
    case 'needs_attention':
    case 'verification_required':
      return 'verification_required'
    default:
      return 'pending'
  }
}

function mapEmployeeOnboardingStatus(status: string | undefined): PayrollEmployeeResult['onboardingStatus'] {
  switch (status) {
    case 'completed':
    case 'ready':
      return 'ready'
    case 'verifying':
    case 'verification_pending':
      return 'verification_pending'
    case 'blocking':
    case 'needs_attention':
    case 'information_required':
      return 'information_required'
    default:
      return 'not_started'
  }
}

function mapW9Status(status: string | undefined): PayrollContractorResult['w9Status'] {
  if (status === 'completed' || status === 'verified') return 'verified'
  if (status === 'pending' || status === 'blocking') return 'pending'
  return 'not_collected'
}

function mapBankVerificationStatus(status: string | undefined): PayrollBankAccountResult['verificationStatus'] {
  if (status === 'verified') return 'verified'
  if (status === 'failed' || status === 'rejected') return 'failed'
  return 'pending'
}

function mapSubmissionStatus(status: string | undefined): PayrollSubmissionResult['status'] {
  switch (status) {
    case 'submitted':
      return 'submitted'
    case 'processing':
      return 'processing'
    case 'paid':
      return 'paid'
    case 'partially_processed':
      return 'partially_processed'
    case 'completed':
      return 'completed'
    case 'failed':
    case 'canceled':
    case 'cancelled':
      return 'failed'
    default:
      return 'processing'
  }
}

function mapLineResult(i: any) {
  return {
    employeeExternalId: i.employee ?? i.employee_id,
    grossPay: i.gross_pay ?? '0',
    pretaxDeductions: i.pretax_deductions ?? '0',
    employeeTax: i.employee_taxes ?? '0',
    posttaxDeductions: i.posttax_deductions ?? '0',
    garnishments: i.garnishments ?? '0',
    reimbursements: i.reimbursements ?? '0',
    netPay: i.net_pay ?? '0',
    employerTax: i.employer_taxes ?? '0',
    employerBenefitsCost: i.employer_benefits_contributions ?? '0',
  }
}

function mapCalculationResult(json: any): PayrollCalculationResult {
  const items = json.items ?? json.line_items ?? []
  return {
    providerPayrollId: json.id,
    status: json.status === 'failed' || json.warnings?.length ? 'needs_attention' : 'calculated',
    totalGross: json.totals?.gross ?? '0',
    totalEmployeeTax: json.totals?.employee_taxes ?? '0',
    totalEmployerTax: json.totals?.employer_taxes ?? '0',
    totalPretaxDeductions: json.totals?.pretax_deductions ?? '0',
    totalPosttaxDeductions: json.totals?.posttax_deductions ?? '0',
    totalReimbursements: json.totals?.reimbursements ?? '0',
    totalNetPay: json.totals?.net_pay ?? '0',
    debitDate: json.debit_date ?? json.period_end,
    employeePaymentDate: json.payday ?? json.period_end,
    lines: items.map(mapLineResult),
    warnings: json.warnings ?? [],
  }
}
