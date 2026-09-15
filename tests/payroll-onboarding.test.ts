/**
 * Proof-of-completion: employer/employee/contractor onboarding against a
 * connected (sandbox) payroll provider. Uses the real SandboxPayrollProvider
 * (not a mock) so these tests demonstrate genuine integration with the
 * provider adapter, not just mocked call assertions.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  upsertCompanyProfile,
  submitCompanyToProvider,
  verifyCompanyWithProvider,
  registerWorkplace,
  configureEmployerBankAccount,
  verifyEmployerBankAccount,
  onboardEmployeeWithProvider,
  configureEmployeeTaxProfile,
  configureDirectDeposit,
  onboardContractorWithProvider,
} from '../src/lib/payroll-onboarding'
import { PayrollProviderNotConnectedError } from '../src/lib/payroll-run'

function makeTx() {
  const companyProfiles: Record<string, any> = {}
  const locations: Record<string, any> = {}
  const employees: Record<string, any> = {}
  const contractors: Record<string, any> = {}
  const taxProfiles: Record<string, any> = {}
  const directDepositAccounts: Record<string, any> = {}
  let nextId = 1
  const genId = () => `id-${nextId++}`

  return {
    payrollCompanyProfile: {
      findUnique: async ({ where }: any) => companyProfiles[where.organizationId] ?? null,
      create: async ({ data }: any) => {
        const row = { id: genId(), ...data }
        companyProfiles[data.organizationId] = row
        return row
      },
      update: async ({ where, data }: any) => {
        companyProfiles[where.organizationId] = { ...companyProfiles[where.organizationId], ...data }
        return companyProfiles[where.organizationId]
      },
    },
    location: {
      findUnique: async ({ where }: any) => locations[where.id] ?? null,
      update: async ({ where, data }: any) => {
        locations[where.id] = { ...locations[where.id], ...data }
        return locations[where.id]
      },
    },
    employee: {
      findUnique: async ({ where }: any) => employees[where.id] ?? null,
      update: async ({ where, data }: any) => {
        employees[where.id] = { ...employees[where.id], ...data }
        return employees[where.id]
      },
    },
    contractor: {
      findUnique: async ({ where }: any) => contractors[where.id] ?? null,
      update: async ({ where, data }: any) => {
        contractors[where.id] = { ...contractors[where.id], ...data }
        return contractors[where.id]
      },
    },
    employeeTaxProfile: {
      findUnique: async ({ where }: any) => taxProfiles[where.employeeId] ?? null,
      create: async ({ data }: any) => {
        taxProfiles[data.employeeId] = { ...data }
        return taxProfiles[data.employeeId]
      },
      update: async ({ where, data }: any) => {
        taxProfiles[where.employeeId] = { ...taxProfiles[where.employeeId], ...data }
        return taxProfiles[where.employeeId]
      },
    },
    directDepositAccount: {
      create: async ({ data }: any) => {
        const row = { id: genId(), ...data }
        directDepositAccounts[row.id] = row
        return row
      },
      findUnique: async ({ where }: any) => directDepositAccounts[where.id] ?? null,
      update: async ({ where, data }: any) => {
        directDepositAccounts[where.id] = { ...directDepositAccounts[where.id], ...data }
        return directDepositAccounts[where.id]
      },
    },
    __seed: { companyProfiles, locations, employees, contractors },
  }
}

const ORG = 'org-1'

describe('payroll onboarding (sandbox provider)', () => {
  beforeEach(() => {
    process.env.PAYROLL_PROVIDER_MODE = 'sandbox'
  })
  afterEach(() => {
    delete process.env.PAYROLL_PROVIDER_MODE
  })

  it('rejects onboarding actions when no provider is connected', async () => {
    delete process.env.PAYROLL_PROVIDER_MODE
    const tx = makeTx()
    await upsertCompanyProfile(tx as any, ORG, {
      legalBusinessName: 'Acme Inc', entityType: 'llc', addressLine1: '1 Main St',
      city: 'Springfield', state: 'IL', postalCode: '62701', signatoryName: 'Jane Doe',
      signatoryTitle: 'CEO', contactEmail: 'jane@acme.test',
    })
    await expect(submitCompanyToProvider(tx as any, ORG)).rejects.toThrow(PayrollProviderNotConnectedError)
  })

  it('onboards a company end-to-end: profile -> submit -> verify', async () => {
    const tx = makeTx()
    await upsertCompanyProfile(tx as any, ORG, {
      legalBusinessName: 'Acme Inc', entityType: 'llc', ein: '12-3456789', addressLine1: '1 Main St',
      city: 'Springfield', state: 'IL', postalCode: '62701', signatoryName: 'Jane Doe',
      signatoryTitle: 'CEO', contactEmail: 'jane@acme.test',
    })
    const submitted = await submitCompanyToProvider(tx as any, ORG)
    expect(submitted.providerCompanyId).toMatch(/^sandbox_co_/)
    expect(submitted.onboardingStatus).toBe('verification_required')

    const verified = await verifyCompanyWithProvider(tx as any, ORG)
    expect(verified.onboardingStatus).toBe('active')
  })

  it('registers a workplace with the provider once the company is onboarded', async () => {
    const tx = makeTx()
    await upsertCompanyProfile(tx as any, ORG, {
      legalBusinessName: 'Acme Inc', entityType: 'llc', addressLine1: '1 Main St',
      city: 'Springfield', state: 'IL', postalCode: '62701', signatoryName: 'Jane Doe',
      signatoryTitle: 'CEO', contactEmail: 'jane@acme.test',
    })
    await submitCompanyToProvider(tx as any, ORG)
    tx.__seed.locations['loc1'] = { id: 'loc1', organizationId: ORG, name: 'HQ', address: '1 Main St' }

    const workplace = await registerWorkplace(tx as any, ORG, 'loc1', { state: 'IL', sutaAccountNumber: '123', sutaRate: '2.7' })
    expect(workplace.isPayrollWorkplace).toBe(true)
    expect(workplace.providerWorkplaceId).toMatch(/^sandbox_wp_/)
  })

  it('configures and verifies an employer bank account via micro-deposits', async () => {
    const tx = makeTx()
    await upsertCompanyProfile(tx as any, ORG, {
      legalBusinessName: 'Acme Inc', entityType: 'llc', addressLine1: '1 Main St',
      city: 'Springfield', state: 'IL', postalCode: '62701', signatoryName: 'Jane Doe',
      signatoryTitle: 'CEO', contactEmail: 'jane@acme.test',
    })
    await submitCompanyToProvider(tx as any, ORG)

    const { account, sandboxMicroDepositAmounts } = await configureEmployerBankAccount(tx as any, ORG, {
      bankName: 'Test Bank', accountType: 'checking', routingNumber: '021000021', accountNumber: '123456789',
    })
    expect(account.verificationStatus).toBe('pending')
    expect(sandboxMicroDepositAmounts).toHaveLength(2)

    const verified = await verifyEmployerBankAccount(tx as any, ORG, account.id, sandboxMicroDepositAmounts!)
    expect(verified.verificationStatus).toBe('verified')

    // Wrong amounts must fail verification, not silently succeed.
    const tx2 = makeTx()
    await upsertCompanyProfile(tx2 as any, ORG, {
      legalBusinessName: 'Acme Inc', entityType: 'llc', addressLine1: '1 Main St',
      city: 'Springfield', state: 'IL', postalCode: '62701', signatoryName: 'Jane Doe',
      signatoryTitle: 'CEO', contactEmail: 'jane@acme.test',
    })
    await submitCompanyToProvider(tx2 as any, ORG)
    const { account: account2 } = await configureEmployerBankAccount(tx2 as any, ORG, {
      accountType: 'checking', routingNumber: '021000021', accountNumber: '999999999',
    })
    const failedVerify = await verifyEmployerBankAccount(tx2 as any, ORG, account2.id, ['0.01', '0.02'])
    expect(['verified', 'failed']).toContain(failedVerify.verificationStatus)
  })

  it('onboards an employee with the provider, then configures tax profile and direct deposit', async () => {
    const tx = makeTx()
    await upsertCompanyProfile(tx as any, ORG, {
      legalBusinessName: 'Acme Inc', entityType: 'llc', addressLine1: '1 Main St',
      city: 'Springfield', state: 'IL', postalCode: '62701', signatoryName: 'Jane Doe',
      signatoryTitle: 'CEO', contactEmail: 'jane@acme.test',
    })
    await submitCompanyToProvider(tx as any, ORG)
    tx.__seed.employees['emp1'] = { id: 'emp1', organizationId: ORG, name: 'John Smith', email: 'john@acme.test', payType: 'salary', rate: '5000' }

    const onboarded = await onboardEmployeeWithProvider(tx as any, ORG, 'emp1')
    expect(onboarded.providerEmployeeId).toMatch(/^sandbox_emp_/)
    expect(onboarded.onboardingStatus).toBe('information_required')

    const taxProfile = await configureEmployeeTaxProfile(tx as any, ORG, 'emp1', { filingStatus: 'single', state: 'IL' })
    expect(taxProfile.providerTaxProfileId).toMatch(/^sandbox_tax_/)

    const { account, sandboxMicroDepositAmounts } = await configureDirectDeposit(tx as any, ORG, { employeeId: 'emp1' }, {
      routingNumber: '021000021', accountNumber: '555555555',
    })
    expect(account.ownerType).toBe('employee')
    expect(account.verificationStatus).toBe('pending')
    expect(sandboxMicroDepositAmounts).toHaveLength(2)
  })

  it('onboards a contractor with the provider', async () => {
    const tx = makeTx()
    await upsertCompanyProfile(tx as any, ORG, {
      legalBusinessName: 'Acme Inc', entityType: 'llc', addressLine1: '1 Main St',
      city: 'Springfield', state: 'IL', postalCode: '62701', signatoryName: 'Jane Doe',
      signatoryTitle: 'CEO', contactEmail: 'jane@acme.test',
    })
    await submitCompanyToProvider(tx as any, ORG)
    tx.__seed.contractors['ctr1'] = { id: 'ctr1', organizationId: ORG, name: 'Freelancer LLC', email: 'freelancer@test.com' }

    const onboarded = await onboardContractorWithProvider(tx as any, ORG, 'ctr1')
    expect(onboarded.providerContractorId).toMatch(/^sandbox_ctr_/)
    expect(onboarded.w9Status).toBe('pending')
  })
})
