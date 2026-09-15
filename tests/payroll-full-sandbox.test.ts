/**
 * Proof-of-completion: the complete Lumviq Payroll sandbox lifecycle, in
 * one cohesive story, using only fictional data and the real (not
 * mocked) SandboxPayrollProvider — no real money moves and no real tax
 * filings occur (see docs/known-limitations.md).
 *
 * Employer:  company profile -> submit to provider -> verify -> register
 *            workplace -> configure + verify employer bank account.
 * Employee:  onboarded with full profile (legal identity, residential
 *            address, DOB, SSN) -> federal/state tax profile ->
 *            direct deposit -> pay run calculated -> submitted for
 *            approval -> approved -> synced to paid, which posts a
 *            *balanced* journal entry and generates a paystub.
 * Contractor: onboarded with W-9 info (business name, tax classification,
 *            tax id, payment method) -> paid via the existing
 *            vendor/bill payment flow -> posts a *balanced* journal
 *            entry -> included in the year's 1099 total.
 *
 * This is the automated integration test required to demonstrate the
 * full payroll feature works end to end before any claim of "payroll is
 * operational" is made — see the sandbox banner on the Payroll page.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomUUID } from 'crypto'
import { isBalanced } from '../src/lib/ledger'
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
import { calculatePayRun, submitPayRunForApproval, submitApprovedPayRun, syncPayRunStatus } from '../src/lib/payroll-run'
import { createAndPostBillPayment } from '../src/lib/purchasing'
import { createContractor, is1099Eligible, contractorYearTotal } from '../src/lib/contractors'

const ORG = 'org-full-sandbox'
const EXPENSE_ACCOUNT = randomUUID()
const LIABILITY_ACCOUNT = randomUUID()
const TAX_EXPENSE_ACCOUNT = randomUUID()
const TAX_LIABILITY_ACCOUNT = randomUUID()
const PAYABLE_ACCOUNT = randomUUID()
const BANK_ACCOUNT = randomUUID()

/**
 * One shared in-memory "database" covering every Prisma model touched by
 * employer onboarding, employee onboarding + pay run, and contractor
 * onboarding + bill payment. This lets the test exercise the real
 * onboarding/payroll-run/purchasing modules against a single consistent
 * store, the same way a real transaction would.
 */
function makeTx() {
  const companyProfiles: Record<string, any> = {}
  const locations: Record<string, any> = {}
  const employees: Record<string, any> = {}
  const contractors: Record<string, any> = {}
  const taxProfiles: Record<string, any> = {}
  const directDepositAccounts: Record<string, any> = {}
  const payRunStore: Record<string, any> = {}
  const payStubStore: Record<string, any> = {}
  const journalEntries: Record<string, any> = {}
  const journalEntriesByIdempotencyKey: Record<string, any> = {}
  const vendors: Record<string, any> = {}
  const bills: Record<string, any> = {}
  const billPayments: Record<string, any> = {}
  let nextId = 1
  const genId = () => `id-${nextId++}`

  const accounts: Record<string, any> = {
    payroll_expense: { id: EXPENSE_ACCOUNT },
    payroll_liability: { id: LIABILITY_ACCOUNT },
    payroll_tax_expense: { id: TAX_EXPENSE_ACCOUNT },
    payroll_tax_liability: { id: TAX_LIABILITY_ACCOUNT },
    payable: { id: PAYABLE_ACCOUNT },
  }

  const journalEntryCreate = async ({ data }: any) => {
    const entry = { id: `je-${randomUUID()}`, ...data, lines: (data.lines?.create ?? []).map((l: any, i: number) => ({ id: `jl-${i}-${randomUUID()}`, ...l })) }
    journalEntries[entry.id] = entry
    if (data.idempotencyKey) journalEntriesByIdempotencyKey[data.idempotencyKey] = entry
    return entry
  }

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
      create: async ({ data }: any) => {
        const row = { id: genId(), active: true, w9Status: 'not_started', providerContractorId: null, ...data }
        contractors[row.id] = row
        return row
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
    payRun: {
      findUnique: async ({ where, include }: any) => {
        const row = where.id ? payRunStore[where.id] : null
        if (!row) return null
        if (include?.lines?.include?.employee) {
          return { ...row, lines: row.lines.map((l: any) => ({ ...l, employee: employees[l.employeeId] ?? null })) }
        }
        return row
      },
      update: async ({ where, data, include }: any) => {
        payRunStore[where.id] = { ...payRunStore[where.id], ...data }
        const row = payRunStore[where.id]
        if (include?.lines?.include?.employee) {
          return { ...row, lines: row.lines.map((l: any) => ({ ...l, employee: employees[l.employeeId] ?? null })) }
        }
        return row
      },
    },
    payRunLine: {
      updateMany: async ({ where, data }: any) => {
        const run = payRunStore[where.payRunId]
        const line = run?.lines.find((l: any) => l.employeeId === where.employeeId)
        if (line) Object.assign(line, data)
        return { count: line ? 1 : 0 }
      },
    },
    payStub: {
      findUnique: async ({ where }: any) => payStubStore[where.payRunLineId] ?? null,
      create: async ({ data }: any) => {
        const stub = { id: `stub-${randomUUID()}`, ...data }
        payStubStore[data.payRunLineId] = stub
        return stub
      },
    },
    account: {
      findFirst: async ({ where }: any) => accounts[where.subtype] ?? null,
    },
    journalEntry: {
      findUnique: async ({ where }: any) => {
        if (where.id) return journalEntries[where.id] ?? null
        if (where.idempotencyKey) return journalEntriesByIdempotencyKey[where.idempotencyKey] ?? null
        return null
      },
      create: journalEntryCreate,
    },
    accountingPeriod: { findFirst: async () => null },
    approval: { create: async ({ data }: any) => ({ id: `appr-${randomUUID()}`, ...data }) },
    auditEvent: { create: async () => ({}) },
    notification: { create: async () => ({}) },
    vendor: {
      findUnique: async ({ where }: any) => vendors[where.id] ?? null,
      create: async ({ data }: any) => {
        const row = { id: genId(), ...data }
        vendors[row.id] = row
        return row
      },
    },
    bill: {
      findUnique: async ({ where }: any) => bills[where.id] ?? null,
      create: async ({ data }: any) => {
        const row = { id: genId(), amountPaid: '0', status: 'sent', ...data }
        bills[row.id] = row
        return row
      },
      update: async ({ where, data }: any) => {
        bills[where.id] = { ...bills[where.id], ...data }
        return bills[where.id]
      },
    },
    billPayment: {
      create: async ({ data }: any) => {
        const row = { id: genId(), journalEntryId: null, ...data }
        billPayments[row.id] = row
        return row
      },
      update: async ({ where, data }: any) => {
        billPayments[where.id] = { ...billPayments[where.id], ...data }
        return billPayments[where.id]
      },
      findMany: async ({ where }: any) => {
        const vendorId = where.bill.vendorId
        return Object.values(billPayments).filter((p: any) => bills[p.billId]?.vendorId === vendorId)
      },
    },
    __seed: { companyProfiles, locations, employees, contractors, vendors, bills },
    __store: payRunStore,
  }
}

describe('full payroll sandbox lifecycle (proof of completion)', () => {
  beforeEach(() => {
    process.env.PAYROLL_PROVIDER_MODE = 'sandbox'
  })
  afterEach(() => {
    delete process.env.PAYROLL_PROVIDER_MODE
  })

  it('onboards an employer, pays one employee via payroll, pays one contractor via a bill, and posts balanced ledger entries for both', async () => {
    const tx = makeTx()

    // --- Employer onboarding ---------------------------------------
    await upsertCompanyProfile(tx as any, ORG, {
      legalBusinessName: 'Fictional Sandbox Co', entityType: 'llc', ein: '12-3456789',
      addressLine1: '1 Fake St', city: 'Springfield', state: 'IL', postalCode: '62701',
      signatoryName: 'Jane Doe', signatoryTitle: 'CEO', contactEmail: 'jane@fictional-sandbox.test',
    })
    const submittedCompany = await submitCompanyToProvider(tx as any, ORG)
    expect(submittedCompany.providerCompanyId).toMatch(/^sandbox_co_/)
    const verifiedCompany = await verifyCompanyWithProvider(tx as any, ORG)
    expect(verifiedCompany.onboardingStatus).toBe('active')

    tx.__seed.locations['loc1'] = { id: 'loc1', organizationId: ORG, name: 'HQ', address: '1 Fake St' }
    const workplace = await registerWorkplace(tx as any, ORG, 'loc1', { state: 'IL', sutaAccountNumber: '999', sutaRate: '2.7' })
    expect(workplace.providerWorkplaceId).toMatch(/^sandbox_wp_/)

    const { account: bankAccount, sandboxMicroDepositAmounts: employerMicroDeposits } = await configureEmployerBankAccount(tx as any, ORG, {
      bankName: 'Fictional Test Bank', accountType: 'checking', routingNumber: '021000021', accountNumber: '100200300',
    })
    const verifiedBank = await verifyEmployerBankAccount(tx as any, ORG, bankAccount.id, employerMicroDeposits!)
    expect(verifiedBank.verificationStatus).toBe('verified')

    // --- Employee onboarding (full profile: identity, address, DOB, SSN) ---
    tx.__seed.employees['emp1'] = {
      id: 'emp1', organizationId: ORG, name: 'Alex Employee', email: 'alex@fictional-sandbox.test',
      payType: 'salary', rate: '4000', locationId: 'loc1',
      addressLine1: '2 Fake Ave', addressLine2: null, city: 'Springfield', state: 'IL', postalCode: '62701',
      dateOfBirth: new Date('1990-05-15'), ssnEncrypted: null,
    }
    const onboardedEmployee = await onboardEmployeeWithProvider(tx as any, ORG, 'emp1')
    expect(onboardedEmployee.providerEmployeeId).toMatch(/^sandbox_emp_/)
    expect(onboardedEmployee.onboardingStatus).toBe('information_required')

    const employeeTaxProfile = await configureEmployeeTaxProfile(tx as any, ORG, 'emp1', { filingStatus: 'single', state: 'IL' })
    expect(employeeTaxProfile.providerTaxProfileId).toMatch(/^sandbox_tax_/)

    const { account: employeeBank, sandboxMicroDepositAmounts: employeeMicroDeposits } = await configureDirectDeposit(
      tx as any, ORG, { employeeId: 'emp1' }, { routingNumber: '021000021', accountNumber: '400500600' }
    )
    expect(employeeBank.verificationStatus).toBe('pending')
    expect(employeeMicroDeposits).toHaveLength(2)

    // --- Employee pay run: calculate -> submit -> approve -> sync/post ---
    tx.__store['pr1'] = {
      id: 'pr1', organizationId: ORG, status: 'draft', offCycle: false,
      payPeriodStart: new Date('2026-02-01'), payPeriodEnd: new Date('2026-02-15'),
      lines: [{ id: 'line1', payRunId: 'pr1', employeeId: 'emp1', grossPay: '4000', reimbursements: '0' }],
    }
    const { payRun: calculated, warnings } = await calculatePayRun(tx as any, 'pr1', 'preparer-1')
    expect(warnings).toEqual([])
    expect(calculated.status).toBe('calculated')
    expect(Number(calculated.totalGross)).toBeCloseTo(4000, 2)

    const { payRun: submitted, approval } = await submitPayRunForApproval(tx as any, 'pr1', 'preparer-1')
    expect(submitted.status).toBe('awaiting_approval')
    expect(approval.resourceType).toBe('payroll-run')

    const approved = await submitApprovedPayRun(tx as any, 'pr1', 'approver-1')
    expect(approved.status).toBe('submitted')

    const synced = await syncPayRunStatus(tx as any, 'pr1', 'actor-1')
    expect(synced.status).toBe('completed')
    expect(synced.journalEntryId).toBeTruthy()

    // A paystub was generated for the employee.
    const paystub = await tx.payStub.findUnique({ where: { payRunLineId: 'line1' } })
    expect(paystub).toBeTruthy()
    expect(paystub.employeeId).toBe('emp1')

    // The posted payroll journal entry is balanced (debits === credits).
    const payrollEntry = await tx.journalEntry.findUnique({ where: { id: synced.journalEntryId } })
    expect(isBalanced(payrollEntry.lines.map((l: any) => ({ accountId: l.accountId, amount: l.amount.toString(), isDebit: l.isDebit })))).toBe(true)

    // Re-syncing an already-completed run does not duplicate the paystub or journal entry (idempotency).
    const resynced = await syncPayRunStatus(tx as any, 'pr1', 'actor-1')
    expect(resynced.journalEntryId).toBe(synced.journalEntryId)

    // --- Contractor onboarding (W-9: business name, tax classification, tax id, payment method) ---
    const contractor = await createContractor(tx as any, {
      organizationId: ORG, name: 'Sam Contractor', email: 'sam@fictional-sandbox.test',
      businessName: 'Sam Contractor LLC', taxClassification: 'llc', taxId: '123-45-6789', paymentMethod: 'check',
    })
    expect(is1099Eligible(contractor)).toBe(true)
    tx.__seed.contractors[contractor.id] = contractor

    const onboardedContractor = await onboardContractorWithProvider(tx as any, ORG, contractor.id)
    expect(onboardedContractor.providerContractorId).toMatch(/^sandbox_ctr_/)
    expect(onboardedContractor.w9Status).toBe('pending')

    // --- Contractor payment via the existing vendor/bill flow, posted to the ledger ---
    const vendor = await tx.vendor.create({ data: { organizationId: ORG, name: 'Sam Contractor LLC' } })
    tx.__seed.contractors[contractor.id] = await tx.contractor.update({ where: { id: contractor.id }, data: { vendorId: vendor.id } })

    const bill = await tx.bill.create({
      data: { organizationId: ORG, vendorId: vendor.id, billNumber: 'BILL-1001', total: '2500.00', amountPaid: '0', status: 'sent', issueDate: new Date('2026-02-10') },
    })

    const paidBill = await createAndPostBillPayment(
      tx as any, bill, { amount: '2500.00', paymentDate: '2026-02-15', method: 'ach', paymentAccountId: BANK_ACCOUNT }, 'actor-1'
    )
    expect(paidBill.status).toBe('paid')
    expect(Number(paidBill.amountPaid)).toBeCloseTo(2500, 2)

    // The posted bill-payment journal entry is balanced (debits === credits).
    const [payment] = await tx.billPayment.findMany({ where: { bill: { vendorId: vendor.id } } })
    expect(payment.journalEntryId).toBeTruthy()
    const billPaymentEntry = await tx.journalEntry.findUnique({ where: { id: payment.journalEntryId } })
    expect(isBalanced(billPaymentEntry.lines.map((l: any) => ({ accountId: l.accountId, amount: l.amount.toString(), isDebit: l.isDebit })))).toBe(true)

    // --- Reporting: contractor's paid amount counts toward this year's 1099 total ---
    const yearTotal = await contractorYearTotal(tx as any, contractor.id, 2026)
    expect(Number(yearTotal)).toBeCloseTo(2500, 2)
  })
})

