/**
 * Payroll onboarding: employer company profile, workplaces, employer
 * bank-account verification, employee/contractor provider onboarding,
 * tax-withholding profiles and direct-deposit setup. This is the "before
 * you can run payroll" half of the workflow — src/lib/payroll-run.ts
 * covers the pay-run lifecycle itself.
 *
 * Every provider-facing action here requires a connected PayrollProvider
 * (PayrollProviderNotConnectedError otherwise) — nothing in this file
 * calculates real tax withholding or moves money on its own; it only
 * relays onboarding data to whichever provider is connected (sandbox in
 * test mode, a licensed provider once one is contracted).
 */
import { getPayrollProvider } from './integrations/payroll-sandbox'
import type { PayrollProvider } from './integrations/payroll'
import { PayrollProviderNotConnectedError } from './payroll-run'
import { encryptField, last4 } from './encryption'

function requireProvider(): PayrollProvider {
  const provider = getPayrollProvider()
  if (!provider || !provider.isConfigured()) throw new PayrollProviderNotConnectedError()
  return provider
}

// ---------------------------------------------------------------------------
// Employer company onboarding
// ---------------------------------------------------------------------------

export interface CompanyProfileInput {
  legalBusinessName: string
  entityType: string
  ein?: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  signatoryName: string
  signatoryTitle: string
  contactEmail: string
  contactPhone?: string
}

/** Creates or updates the organization's local payroll company profile (does not yet talk to the provider). */
export async function upsertCompanyProfile(tx: any, organizationId: string, input: CompanyProfileInput) {
  const data: any = {
    legalBusinessName: input.legalBusinessName,
    entityType: input.entityType,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2 ?? null,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    signatoryName: input.signatoryName,
    signatoryTitle: input.signatoryTitle,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone ?? null,
  }
  if (input.ein) {
    data.einEncrypted = encryptField(input.ein)
    data.einLast4 = last4(input.ein)
  }
  const existing = await tx.payrollCompanyProfile.findUnique({ where: { organizationId } })
  if (existing) {
    return tx.payrollCompanyProfile.update({ where: { organizationId }, data })
  }
  return tx.payrollCompanyProfile.create({ data: { organizationId, onboardingStatus: 'information_required', ...data } })
}

/** Sends the local company profile to the connected provider (create on first call, update thereafter). */
export async function submitCompanyToProvider(tx: any, organizationId: string) {
  const profile = await tx.payrollCompanyProfile.findUnique({ where: { organizationId } })
  if (!profile) throw new Error('Complete the company profile before submitting to the payroll provider')
  const provider = requireProvider()

  const address = {
    line1: profile.addressLine1,
    line2: profile.addressLine2 ?? undefined,
    city: profile.city,
    state: profile.state,
    postalCode: profile.postalCode,
  }
  const result = profile.providerCompanyId
    ? await provider.updateCompany(profile.providerCompanyId, { legalName: profile.legalBusinessName, address })
    : await provider.createCompany({ legalName: profile.legalBusinessName, address })

  return tx.payrollCompanyProfile.update({
    where: { organizationId },
    data: { providerCompanyId: result.externalId, onboardingStatus: result.status },
  })
}

/** Asks the provider to verify the company (moves it from verification_required to active in sandbox). */
export async function verifyCompanyWithProvider(tx: any, organizationId: string) {
  const profile = await tx.payrollCompanyProfile.findUnique({ where: { organizationId } })
  if (!profile?.providerCompanyId) throw new Error('Submit the company profile to the provider first')
  const provider = requireProvider()
  const result = await provider.verifyCompany(profile.providerCompanyId)
  return tx.payrollCompanyProfile.update({ where: { organizationId }, data: { onboardingStatus: result.status } })
}

// ---------------------------------------------------------------------------
// Workplace (work location + tax jurisdiction) onboarding
// ---------------------------------------------------------------------------

export interface WorkplaceJurisdictionInput {
  state: string
  sutaAccountNumber?: string
  sutaRate?: string
}

/** Marks a Location as a payroll workplace, sets its tax-jurisdiction fields, and registers it with the provider. */
export async function registerWorkplace(tx: any, organizationId: string, locationId: string, input: WorkplaceJurisdictionInput) {
  const location = await tx.location.findUnique({ where: { id: locationId } })
  if (!location || location.organizationId !== organizationId) throw new Error('Location not found')
  const profile = await tx.payrollCompanyProfile.findUnique({ where: { organizationId } })
  if (!profile?.providerCompanyId) throw new Error('Onboard the company with the payroll provider before registering workplaces')

  const provider = requireProvider()
  const result = location.providerWorkplaceId
    ? await provider.updateWorkplace(location.providerWorkplaceId, {
        name: location.name,
        address: { line1: location.address || '', city: '', state: input.state, postalCode: '' },
      })
    : await provider.createWorkplace({
        companyExternalId: profile.providerCompanyId,
        name: location.name,
        address: { line1: location.address || '', city: '', state: input.state, postalCode: '' },
      })

  return tx.location.update({
    where: { id: locationId },
    data: {
      isPayrollWorkplace: true,
      state: input.state,
      sutaAccountNumber: input.sutaAccountNumber ?? null,
      sutaRate: input.sutaRate ?? null,
      providerWorkplaceId: result.externalId,
    },
  })
}

// ---------------------------------------------------------------------------
// Employer bank account (payroll funding) + verification
// ---------------------------------------------------------------------------

export interface BankAccountInput {
  bankName?: string
  accountType?: string
  routingNumber: string
  accountNumber: string
}

/** Configures the organization's own funding/debit bank account with the provider. Returns sandbox micro-deposit amounts (test mode only) so verifyEmployerBankAccount can be exercised immediately. */
export async function configureEmployerBankAccount(tx: any, organizationId: string, input: BankAccountInput) {
  const profile = await tx.payrollCompanyProfile.findUnique({ where: { organizationId } })
  if (!profile?.providerCompanyId) throw new Error('Onboard the company with the payroll provider before adding a bank account')
  const provider = requireProvider()

  const result = await provider.configureBankAccount({
    ownerExternalId: profile.providerCompanyId,
    routingNumber: input.routingNumber,
    accountNumber: input.accountNumber,
    accountType: (input.accountType as 'checking' | 'savings') || 'checking',
  })

  const account = await tx.directDepositAccount.create({
    data: {
      organizationId,
      ownerType: 'employer',
      bankName: input.bankName ?? null,
      accountType: input.accountType || 'checking',
      routingNumberEncrypted: encryptField(input.routingNumber),
      accountNumberEncrypted: encryptField(input.accountNumber),
      accountLast4: result.last4,
      verificationStatus: result.verificationStatus,
      providerAccountId: result.externalId,
    },
  })

  return { account, sandboxMicroDepositAmounts: result.sandboxMicroDepositAmounts }
}

/** Completes the employer bank account's micro-deposit verification challenge. */
export async function verifyEmployerBankAccount(tx: any, organizationId: string, accountId: string, amounts: [string, string]) {
  const account = await tx.directDepositAccount.findUnique({ where: { id: accountId } })
  if (!account || account.organizationId !== organizationId || account.ownerType !== 'employer') {
    throw new Error('Employer bank account not found')
  }
  if (!account.providerAccountId) throw new Error('Bank account was never registered with the provider')
  const provider = requireProvider()
  const result = await provider.verifyBankAccount(account.providerAccountId, amounts)
  return tx.directDepositAccount.update({ where: { id: accountId }, data: { verificationStatus: result.verificationStatus } })
}

// ---------------------------------------------------------------------------
// Employee onboarding: provider record, tax profile, direct deposit
// ---------------------------------------------------------------------------

/** Creates (or re-links) the employee with the connected provider and marks onboarding as in progress. */
export async function onboardEmployeeWithProvider(tx: any, organizationId: string, employeeId: string) {
  const employee = await tx.employee.findUnique({ where: { id: employeeId } })
  if (!employee || employee.organizationId !== organizationId) throw new Error('Employee not found')
  const profile = await tx.payrollCompanyProfile.findUnique({ where: { organizationId } })
  if (!profile?.providerCompanyId) throw new Error('Onboard the company with the payroll provider before onboarding employees')
  const provider = requireProvider()

  const [firstName, ...rest] = employee.name.split(' ')
  const result = employee.providerEmployeeId
    ? await provider.updateEmployee(employee.providerEmployeeId, {})
    : await provider.createEmployee({
        companyExternalId: profile.providerCompanyId,
        firstName: firstName || employee.name,
        lastName: rest.join(' ') || '-',
        email: employee.email ?? undefined,
        payType: employee.payType === 'hourly' ? 'hourly' : 'salary',
        rate: employee.rate.toString(),
      })

  return tx.employee.update({
    where: { id: employeeId },
    data: { providerEmployeeId: result.externalId, onboardingStatus: result.onboardingStatus },
  })
}

export interface EmployeeTaxProfileInput {
  filingStatus?: string
  federalAllowances?: number
  federalExtraWithholding?: string
  state?: string
  stateFilingStatus?: string
  stateAllowances?: number
  stateExtraWithholding?: string
  exemptFromFederal?: boolean
  exemptFromState?: boolean
}

/** Creates/updates an employee's federal + state withholding elections locally, then syncs them to the provider. */
export async function configureEmployeeTaxProfile(tx: any, organizationId: string, employeeId: string, input: EmployeeTaxProfileInput) {
  const employee = await tx.employee.findUnique({ where: { id: employeeId } })
  if (!employee || employee.organizationId !== organizationId) throw new Error('Employee not found')

  const data = {
    filingStatus: input.filingStatus ?? 'single',
    federalAllowances: input.federalAllowances ?? 0,
    federalExtraWithholding: input.federalExtraWithholding ?? '0',
    state: input.state ?? null,
    stateFilingStatus: input.stateFilingStatus ?? null,
    stateAllowances: input.stateAllowances ?? 0,
    stateExtraWithholding: input.stateExtraWithholding ?? '0',
    exemptFromFederal: input.exemptFromFederal ?? false,
    exemptFromState: input.exemptFromState ?? false,
  }
  const existing = await tx.employeeTaxProfile.findUnique({ where: { employeeId } })
  const taxProfile = existing
    ? await tx.employeeTaxProfile.update({ where: { employeeId }, data })
    : await tx.employeeTaxProfile.create({ data: { employeeId, ...data } })

  if (employee.providerEmployeeId) {
    const provider = requireProvider()
    const result = await provider.configureTaxProfile({
      employeeExternalId: employee.providerEmployeeId,
      filingStatus: data.filingStatus,
      federalAllowances: data.federalAllowances,
      federalExtraWithholding: data.federalExtraWithholding,
      state: data.state ?? undefined,
      stateAllowances: data.stateAllowances,
      stateExtraWithholding: data.stateExtraWithholding,
      exemptFromFederal: data.exemptFromFederal,
      exemptFromState: data.exemptFromState,
    })
    return tx.employeeTaxProfile.update({ where: { employeeId }, data: { providerTaxProfileId: result.externalId } })
  }
  return taxProfile
}

export interface DirectDepositInput {
  bankName?: string
  accountType?: string
  routingNumber: string
  accountNumber: string
  splitType?: string
  splitValue?: string
  priority?: number
}

/** Adds a direct-deposit destination for an employee or contractor and registers it with the provider. */
export async function configureDirectDeposit(
  tx: any,
  organizationId: string,
  owner: { employeeId?: string; contractorId?: string },
  input: DirectDepositInput
) {
  let providerOwnerExternalId: string | undefined
  if (owner.employeeId) {
    const employee = await tx.employee.findUnique({ where: { id: owner.employeeId } })
    if (!employee || employee.organizationId !== organizationId) throw new Error('Employee not found')
    providerOwnerExternalId = employee.providerEmployeeId ?? undefined
  } else if (owner.contractorId) {
    const contractor = await tx.contractor.findUnique({ where: { id: owner.contractorId } })
    if (!contractor || contractor.organizationId !== organizationId) throw new Error('Contractor not found')
    providerOwnerExternalId = contractor.providerContractorId ?? undefined
  } else {
    throw new Error('employeeId or contractorId is required')
  }

  let verificationStatus = 'pending'
  let providerAccountId: string | null = null
  let sandboxMicroDepositAmounts: [string, string] | undefined
  if (providerOwnerExternalId) {
    const provider = requireProvider()
    const result = await provider.configureBankAccount({
      ownerExternalId: providerOwnerExternalId,
      routingNumber: input.routingNumber,
      accountNumber: input.accountNumber,
      accountType: (input.accountType as 'checking' | 'savings') || 'checking',
    })
    verificationStatus = result.verificationStatus
    providerAccountId = result.externalId
    sandboxMicroDepositAmounts = result.sandboxMicroDepositAmounts
  }

  const account = await tx.directDepositAccount.create({
    data: {
      organizationId,
      ownerType: owner.employeeId ? 'employee' : 'contractor',
      employeeId: owner.employeeId ?? null,
      contractorId: owner.contractorId ?? null,
      bankName: input.bankName ?? null,
      accountType: input.accountType || 'checking',
      routingNumberEncrypted: encryptField(input.routingNumber),
      accountNumberEncrypted: encryptField(input.accountNumber),
      accountLast4: last4(input.accountNumber),
      splitType: input.splitType || 'remainder',
      splitValue: input.splitValue ?? null,
      priority: input.priority ?? 1,
      verificationStatus,
      providerAccountId,
    },
  })

  return { account, sandboxMicroDepositAmounts }
}

// ---------------------------------------------------------------------------
// Contractor onboarding
// ---------------------------------------------------------------------------

/** Creates the contractor with the connected provider (W-9 collection happens via the provider's hosted flow in production; sandbox marks it pending). */
export async function onboardContractorWithProvider(tx: any, organizationId: string, contractorId: string) {
  const contractor = await tx.contractor.findUnique({ where: { id: contractorId } })
  if (!contractor || contractor.organizationId !== organizationId) throw new Error('Contractor not found')
  const profile = await tx.payrollCompanyProfile.findUnique({ where: { organizationId } })
  if (!profile?.providerCompanyId) throw new Error('Onboard the company with the payroll provider before onboarding contractors')
  const provider = requireProvider()

  const result = await provider.createContractor({
    companyExternalId: profile.providerCompanyId,
    name: contractor.name,
    businessName: contractor.businessName ?? undefined,
    email: contractor.email ?? undefined,
    taxClassification: contractor.taxClassification ?? undefined,
  })

  return tx.contractor.update({
    where: { id: contractorId },
    data: { providerContractorId: result.externalId, w9Status: result.w9Status },
  })
}
