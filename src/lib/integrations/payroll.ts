/**
 * Payroll provider interface — the abstraction layer between Lumviq and a
 * licensed embedded-payroll infrastructure provider (e.g. Check, Gusto
 * Embedded, or similar). Follows the exact same pattern as the other
 * integration stubs in this directory (bank-feed.ts, payments.ts, ocr.ts):
 * define the interface now, wire call sites to it, and swap in a real
 * provider SDK later without changing those call sites.
 *
 * NOT IMPLEMENTED WITH A LIVE PROVIDER: no licensed payroll provider is
 * contracted or connected. `SandboxPayrollProvider` (payroll-sandbox.ts)
 * is a deterministic, clearly-labeled test-mode implementation used so
 * the full payroll-run workflow (calculate -> preview -> approve ->
 * submit -> track) can be built and exercised end-to-end before a real
 * provider is wired in. Lumviq does not calculate authoritative tax
 * withholding, file tax returns, or move money on its own — see
 * docs/integration-adapters.md and docs/known-limitations.md.
 */

export interface PayrollAddress {
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
}

export interface PayrollCompanyInput {
  legalName: string
  ein?: string
  address: PayrollAddress
}

export interface PayrollCompanyResult {
  externalId: string
  status: 'pending' | 'verification_required' | 'active' | 'suspended'
}

export interface PayrollWorkplaceInput {
  companyExternalId: string
  name: string
  address: PayrollAddress
}

export interface PayrollWorkplaceResult {
  externalId: string
}

export interface PayrollEmployeeInput {
  companyExternalId: string
  workplaceExternalId?: string
  firstName: string
  lastName: string
  email?: string
  payType: 'salary' | 'hourly'
  rate: string
  ssn?: string
  dateOfBirth?: string
  address?: PayrollAddress
}

export interface PayrollEmployeeResult {
  externalId: string
  onboardingStatus: 'not_started' | 'information_required' | 'verification_pending' | 'ready'
}

export interface PayrollContractorInput {
  companyExternalId: string
  name: string
  businessName?: string
  email?: string
  taxId?: string
  taxClassification?: string
}

export interface PayrollContractorResult {
  externalId: string
  w9Status: 'not_collected' | 'pending' | 'verified'
}

export interface PayrollBankAccountInput {
  ownerExternalId: string
  routingNumber: string
  accountNumber: string
  accountType: 'checking' | 'savings'
}

export interface PayrollBankAccountResult {
  externalId: string
  verificationStatus: 'pending' | 'verified' | 'failed'
  last4: string
  /** Sandbox-only convenience so the test-mode micro-deposit verification
   * challenge can be completed without a real bank. A real provider never
   * populates this — verification happens on the provider's own hosted
   * flow instead. */
  sandboxMicroDepositAmounts?: [string, string]
}

export interface PayrollTaxProfileInput {
  employeeExternalId: string
  filingStatus: string
  federalAllowances?: number
  federalExtraWithholding?: string
  state?: string
  stateAllowances?: number
  stateExtraWithholding?: string
  exemptFromFederal?: boolean
  exemptFromState?: boolean
}

export interface PayrollTaxProfileResult {
  externalId: string
}

export interface PayrollScheduleInput {
  companyExternalId: string
  frequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
  anchorDate: string
}

export interface PayrollScheduleResult {
  externalId: string
  nextPayDate: string
}

export interface PayrollRunLineInput {
  employeeExternalId: string
  regularHours?: number
  overtimeHours?: number
  grossPay?: string
  reimbursements?: string
}

export interface PayrollCalculationRequest {
  companyExternalId: string
  payPeriodStart: string
  payPeriodEnd: string
  offCycle?: boolean
  lines: PayrollRunLineInput[]
}

export interface PayrollLineCalculationResult {
  employeeExternalId: string
  grossPay: string
  pretaxDeductions: string
  employeeTax: string
  posttaxDeductions: string
  garnishments: string
  reimbursements: string
  netPay: string
  employerTax: string
  employerBenefitsCost: string
}

export interface PayrollCalculationResult {
  providerPayrollId: string
  status: 'calculated' | 'needs_attention'
  totalGross: string
  totalEmployeeTax: string
  totalEmployerTax: string
  totalPretaxDeductions: string
  totalPosttaxDeductions: string
  totalReimbursements: string
  totalNetPay: string
  debitDate: string
  employeePaymentDate: string
  lines: PayrollLineCalculationResult[]
  warnings: string[]
}

export interface PayrollSubmissionResult {
  providerPayrollId: string
  status: 'submitted' | 'processing' | 'paid' | 'partially_processed' | 'completed' | 'failed'
}

export interface PayrollPaystubResult {
  employeeExternalId: string
  pdfUrl?: string
  lines: PayrollLineCalculationResult
}

export interface PayrollTaxLiability {
  jurisdiction: string
  formType: string
  amount: string
  dueDate: string
}

export interface PayrollTaxFilingStatus {
  jurisdiction: string
  formType: string
  filingPeriodStart: string
  filingPeriodEnd: string
  status: 'pending' | 'filed' | 'accepted' | 'rejected'
  confirmationId?: string
}

export interface PayrollTaxDocumentResult {
  ownerExternalId: string
  documentType: 'w2' | 'w3' | '1099-nec' | '1099-misc'
  taxYear: number
  status: 'pending' | 'available' | 'delivered'
  pdfUrl?: string
}

export interface PayrollWebhookEvent {
  externalEventId: string
  eventType: string
  payload: Record<string, unknown>
}

/**
 * Full payroll-provider surface. Every method is provider-agnostic so a
 * real adapter (Check, Gusto Embedded, etc.) can implement this same
 * interface without any call-site changes.
 */
export interface PayrollProvider {
  readonly name: string
  isConfigured(): boolean

  createCompany(input: PayrollCompanyInput): Promise<PayrollCompanyResult>
  updateCompany(externalId: string, input: Partial<PayrollCompanyInput>): Promise<PayrollCompanyResult>
  verifyCompany(externalId: string): Promise<PayrollCompanyResult>

  createWorkplace(input: PayrollWorkplaceInput): Promise<PayrollWorkplaceResult>
  updateWorkplace(externalId: string, input: Partial<PayrollWorkplaceInput>): Promise<PayrollWorkplaceResult>

  createEmployee(input: PayrollEmployeeInput): Promise<PayrollEmployeeResult>
  updateEmployee(externalId: string, input: Partial<PayrollEmployeeInput>): Promise<PayrollEmployeeResult>
  onboardEmployee(externalId: string): Promise<PayrollEmployeeResult>
  createContractor(input: PayrollContractorInput): Promise<PayrollContractorResult>

  configureBankAccount(input: PayrollBankAccountInput): Promise<PayrollBankAccountResult>
  /** Completes bank-account verification (e.g. a micro-deposit challenge). */
  verifyBankAccount(externalId: string, amounts: [string, string]): Promise<PayrollBankAccountResult>
  configureTaxProfile(input: PayrollTaxProfileInput): Promise<PayrollTaxProfileResult>
  createPaySchedule(input: PayrollScheduleInput): Promise<PayrollScheduleResult>

  calculatePayroll(request: PayrollCalculationRequest): Promise<PayrollCalculationResult>
  previewPayroll(providerPayrollId: string): Promise<PayrollCalculationResult>
  approvePayroll(providerPayrollId: string): Promise<PayrollSubmissionResult>
  cancelPayroll(providerPayrollId: string): Promise<PayrollSubmissionResult>
  voidPayroll(providerPayrollId: string): Promise<PayrollSubmissionResult>
  createOffCyclePayroll(request: PayrollCalculationRequest): Promise<PayrollCalculationResult>

  retrievePayroll(providerPayrollId: string): Promise<PayrollSubmissionResult>
  retrievePaystub(providerPayrollId: string, employeeExternalId: string): Promise<PayrollPaystubResult>
  retrieveTaxLiabilities(companyExternalId: string): Promise<PayrollTaxLiability[]>
  retrieveTaxFilings(companyExternalId: string): Promise<PayrollTaxFilingStatus[]>
  retrieveTaxDocuments(companyExternalId: string, taxYear: number): Promise<PayrollTaxDocumentResult[]>
  retrievePaymentStatus(providerPayrollId: string): Promise<PayrollSubmissionResult>

  /** Verifies and parses an inbound provider webhook payload. */
  handleWebhook(rawBody: string, signatureHeader: string | undefined): PayrollWebhookEvent
}
