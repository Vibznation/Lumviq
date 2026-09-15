/**
 * Payroll tax center: syncs outstanding tax liabilities, filing statuses,
 * and year-end tax documents (W-2/1099) from the connected provider, and
 * records reconciling payments against the Payroll Taxes Payable ledger
 * account. Lumviq never calculates or files these itself — the connected
 * provider remains system of record; this module only mirrors provider
 * state into Lumviq's books/UI and records the accounting impact of an
 * actual remittance.
 */
import { getPayrollProvider } from './integrations/payroll-sandbox'
import type { PayrollProvider } from './integrations/payroll'
import { PayrollProviderNotConnectedError } from './payroll-run'
import { postJournalEntryTx } from './ledger'

function requireProvider(): PayrollProvider {
  const provider = getPayrollProvider()
  if (!provider || !provider.isConfigured()) throw new PayrollProviderNotConnectedError()
  return provider
}

async function requireCompanyExternalId(tx: any, organizationId: string): Promise<string> {
  const profile = await tx.payrollCompanyProfile.findUnique({ where: { organizationId } })
  if (!profile?.providerCompanyId) throw new Error('Onboard the company with the payroll provider before syncing tax data')
  return profile.providerCompanyId
}

/** Pulls current outstanding tax liabilities from the provider and upserts TaxFiling rows for reconciliation. */
export async function syncTaxLiabilities(tx: any, organizationId: string) {
  const companyExternalId = await requireCompanyExternalId(tx, organizationId)
  const provider = requireProvider()
  const liabilities = await provider.retrieveTaxLiabilities(companyExternalId)

  const results = []
  for (const liability of liabilities) {
    const dueDate = new Date(liability.dueDate)
    const existing = await tx.taxFiling.findFirst({
      where: { organizationId, jurisdiction: liability.jurisdiction, formType: liability.formType, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      results.push(await tx.taxFiling.update({ where: { id: existing.id }, data: { amount: liability.amount, dueDate } }))
    } else {
      const filingPeriodStart = new Date(dueDate.getFullYear(), dueDate.getMonth() - 1, 1)
      const filingPeriodEnd = new Date(dueDate.getFullYear(), dueDate.getMonth(), 0)
      results.push(
        await tx.taxFiling.create({
          data: {
            organizationId,
            jurisdiction: liability.jurisdiction,
            formType: liability.formType,
            filingPeriodStart,
            filingPeriodEnd,
            dueDate,
            amount: liability.amount,
            status: 'pending',
          },
        })
      )
    }
  }
  return results
}

/** Pulls current filing statuses from the provider and updates/creates matching TaxFiling rows. */
export async function syncTaxFilings(tx: any, organizationId: string) {
  const companyExternalId = await requireCompanyExternalId(tx, organizationId)
  const provider = requireProvider()
  const filings = await provider.retrieveTaxFilings(companyExternalId)

  const results = []
  for (const filing of filings) {
    const existing = await tx.taxFiling.findFirst({
      where: { organizationId, jurisdiction: filing.jurisdiction, formType: filing.formType },
      orderBy: { createdAt: 'desc' },
    })
    const data = {
      status: filing.status,
      providerConfirmation: filing.confirmationId ?? null,
      filedAt: filing.status === 'filed' || filing.status === 'accepted' ? new Date() : null,
    }
    if (existing) {
      results.push(await tx.taxFiling.update({ where: { id: existing.id }, data }))
    } else {
      results.push(
        await tx.taxFiling.create({
          data: {
            organizationId,
            jurisdiction: filing.jurisdiction,
            formType: filing.formType,
            filingPeriodStart: new Date(filing.filingPeriodStart),
            filingPeriodEnd: new Date(filing.filingPeriodEnd),
            dueDate: new Date(filing.filingPeriodEnd),
            ...data,
          },
        })
      )
    }
  }
  return results
}

/**
 * Records an actual remittance against a tax liability: debits Payroll
 * Taxes Payable and credits the paying bank account, then marks the
 * TaxFiling paid. This is the reconciliation step — it only runs once a
 * real payment has actually been made outside Lumviq (or, in sandbox
 * mode, as a simulated test-mode payment).
 */
export async function recordTaxPayment(tx: any, organizationId: string, taxFilingId: string, paymentAccountId: string, actorId: string) {
  const filing = await tx.taxFiling.findUnique({ where: { id: taxFilingId } })
  if (!filing || filing.organizationId !== organizationId) throw new Error('Tax filing not found')
  if (!filing.amount) throw new Error('Tax filing has no outstanding amount')
  if (filing.status === 'paid') return filing

  const taxLiabilityAccount = await tx.account.findFirst({ where: { organizationId, subtype: 'payroll_tax_liability' } })
  const paymentAccount = await tx.account.findUnique({ where: { id: paymentAccountId } })
  if (!taxLiabilityAccount) throw new Error('Payroll Taxes Payable account must be configured for this organization')
  if (!paymentAccount || paymentAccount.organizationId !== organizationId) throw new Error('Payment account not found')

  await postJournalEntryTx(
    tx,
    {
      organizationId,
      description: `Payroll tax payment \u2014 ${filing.jurisdiction} ${filing.formType}`,
      idempotencyKey: `tax-filing:${filing.id}:payment`,
      lines: [
        { accountId: taxLiabilityAccount.id, amount: filing.amount.toString(), isDebit: true },
        { accountId: paymentAccount.id, amount: filing.amount.toString(), isDebit: false },
      ],
    },
    actorId
  )

  return tx.taxFiling.update({ where: { id: taxFilingId }, data: { status: 'paid', filedAt: new Date() } })
}

/** Pulls year-end tax documents (W-2/1099) from the provider and upserts PayrollTaxDocument rows. */
export async function syncTaxDocuments(tx: any, organizationId: string, taxYear: number) {
  const companyExternalId = await requireCompanyExternalId(tx, organizationId)
  const provider = requireProvider()
  const documents = await provider.retrieveTaxDocuments(companyExternalId, taxYear)

  const employees = await tx.employee.findMany({ where: { organizationId, providerEmployeeId: { not: null } } })
  const employeeByExternalId = new Map<string, string>(employees.map((e: any) => [e.providerEmployeeId as string, e.id as string]))
  const contractors = await tx.contractor.findMany({ where: { organizationId, providerContractorId: { not: null } } })
  const contractorByExternalId = new Map<string, string>(contractors.map((c: any) => [c.providerContractorId as string, c.id as string]))

  const results = []
  for (const doc of documents) {
    const employeeId = employeeByExternalId.get(doc.ownerExternalId) ?? null
    const contractorId = employeeId ? null : contractorByExternalId.get(doc.ownerExternalId) ?? null
    const existing = await tx.payrollTaxDocument.findFirst({
      where: { organizationId, documentType: doc.documentType, taxYear, employeeId, contractorId },
    })
    const data = { status: doc.status, deliveredAt: doc.status === 'delivered' ? new Date() : null }
    if (existing) {
      results.push(await tx.payrollTaxDocument.update({ where: { id: existing.id }, data }))
    } else {
      results.push(
        await tx.payrollTaxDocument.create({
          data: {
            organizationId,
            ownerType: employeeId ? 'employee' : 'contractor',
            employeeId,
            contractorId,
            documentType: doc.documentType,
            taxYear,
            ...data,
          },
        })
      )
    }
  }
  return results
}
