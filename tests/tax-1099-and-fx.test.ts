import { describe, it, expect } from 'vitest'
import { generate1099AnnualReport, format1099ReportCsv } from '../src/lib/tax-1099'
import { is1099Eligible } from '../src/lib/contractors'
import { SandboxFxProvider } from '../src/lib/integrations/fx'
import { computeUnrealizedFxBalances } from '../src/lib/fx-revaluation'

describe('1099 Tax Compliance & Annual Report', () => {
  it('correctly classifies 1099 eligibility by tax classification', () => {
    expect(is1099Eligible({ taxClassification: 'individual' })).toBe(true)
    expect(is1099Eligible({ taxClassification: 'llc' })).toBe(true)
    expect(is1099Eligible({ taxClassification: 'sole_proprietor' })).toBe(true)
    expect(is1099Eligible({ taxClassification: 'c_corp' })).toBe(false)
    expect(is1099Eligible({ taxClassification: 's_corp' })).toBe(false)
  })

  it('formats CSV output properly with escaped values', () => {
    const report = {
      taxYear: 2026,
      organizationId: 'org-1',
      thresholdMinor: 60000,
      totalQualifyingMinor: 125000,
      totalQualifying: '1250.00',
      contractorsCount: 2,
      qualifyingContractorsCount: 1,
      contractors: [
        {
          contractorId: 'c1',
          contractorName: 'Alice Smith, LLC',
          businessName: 'Smith Consulting',
          taxClassification: 'llc',
          taxIdLast4: '1234',
          email: 'alice@example.com',
          vendorId: 'v1',
          vendorName: 'Smith Consulting Inc',
          isEligible: true,
          totalPaid: '1250.00',
          totalPaidMinor: 125000,
          meetsThreshold: true,
          formType: '1099-NEC' as const,
          box: 'Box 1: Nonemployee Compensation',
        },
        {
          contractorId: 'c2',
          contractorName: 'Bob Jones',
          businessName: null,
          taxClassification: 'individual',
          taxIdLast4: null,
          email: null,
          vendorId: null,
          vendorName: null,
          isEligible: true,
          totalPaid: '400.00',
          totalPaidMinor: 40000,
          meetsThreshold: false,
          formType: '1099-NEC' as const,
          box: 'Box 1: Nonemployee Compensation',
        },
      ],
    }

    const csv = format1099ReportCsv(report)
    expect(csv).toContain('Tax Year,Contractor Name')
    expect(csv).toContain('"Alice Smith, LLC"')
    expect(csv).toContain('***-**-1234')
    expect(csv).toContain('1250.00,YES')
    expect(csv).toContain('400.00,NO')
  })
})

describe('FX Rate Sync & Revaluation', () => {
  it('provides deterministic sandbox exchange rates', async () => {
    const provider = new SandboxFxProvider()
    const rates = await provider.getLatestRates('USD', ['EUR', 'GBP', 'CAD'])
    expect(rates.length).toBe(3)
    const eur = rates.find((r) => r.quoteCurrency === 'EUR')
    expect(eur?.rate).toBe('0.9200')
  })
})
