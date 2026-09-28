/**
 * 1099-NEC and 1099-MISC tax compliance and reporting engine.
 * Computes calendar-year payments made to non-employee contractors, identifies
 * threshold eligibility ($600 IRS threshold), and prepares downloadable summaries.
 *
 * Disclosure: Lumviq provides audit-ready calculations and reports, but does not
 * directly transmit tax returns or e-file with the IRS. See docs/known-limitations.md.
 */
import { toMinorUnits, fromMinorUnits } from './money'
import { is1099Eligible } from './contractors'

export type Contractor1099Summary = {
  contractorId: string
  contractorName: string
  businessName: string | null
  taxClassification: string | null
  taxIdLast4: string | null
  email: string | null
  vendorId: string | null
  vendorName: string | null
  isEligible: boolean
  totalPaid: string
  totalPaidMinor: number
  meetsThreshold: boolean // >= $600
  formType: '1099-NEC' | '1099-MISC'
  box: string
}

export type Annual1099Report = {
  taxYear: number
  organizationId: string
  thresholdMinor: number
  totalQualifyingMinor: number
  totalQualifying: string
  contractorsCount: number
  qualifyingContractorsCount: number
  contractors: Contractor1099Summary[]
}

const IRS_1099_THRESHOLD_MINOR = 60000 // $600.00 in cents

/**
 * Computes 1099 summaries for all contractors in an organization for a given calendar year.
 */
export async function generate1099AnnualReport(
  tx: any,
  params: { organizationId: string; taxYear: number }
): Promise<Annual1099Report> {
  const { organizationId, taxYear } = params
  const start = new Date(Date.UTC(taxYear, 0, 1))
  const end = new Date(Date.UTC(taxYear + 1, 0, 1))

  const contractors = await tx.contractor.findMany({
    where: { organizationId },
    include: { vendor: true },
    orderBy: { name: 'asc' },
  })

  const summaries: Contractor1099Summary[] = []
  let totalQualifyingMinor = 0

  for (const c of contractors) {
    let paidMinor = 0
    if (c.vendorId) {
      const payments = await tx.billPayment.findMany({
        where: {
          bill: { vendorId: c.vendorId, organizationId },
          paymentDate: { gte: start, lt: end },
        },
        select: { amount: true },
      })
      for (const p of payments) {
        paidMinor += Number(toMinorUnits(p.amount.toString()))
      }
    }

    const eligible = is1099Eligible(c)
    const meetsThreshold = eligible && paidMinor >= IRS_1099_THRESHOLD_MINOR
    if (meetsThreshold) {
      totalQualifyingMinor += paidMinor
    }

    summaries.push({
      contractorId: c.id,
      contractorName: c.name,
      businessName: c.businessName,
      taxClassification: c.taxClassification,
      taxIdLast4: c.taxIdLast4,
      email: c.email,
      vendorId: c.vendorId,
      vendorName: c.vendor?.name ?? null,
      isEligible: eligible,
      totalPaid: fromMinorUnits(BigInt(paidMinor)),
      totalPaidMinor: paidMinor,
      meetsThreshold,
      formType: '1099-NEC',
      box: 'Box 1: Nonemployee Compensation',
    })
  }

  return {
    taxYear,
    organizationId,
    thresholdMinor: IRS_1099_THRESHOLD_MINOR,
    totalQualifyingMinor,
    totalQualifying: fromMinorUnits(BigInt(totalQualifyingMinor)),
    contractorsCount: summaries.length,
    qualifyingContractorsCount: summaries.filter((s) => s.meetsThreshold).length,
    contractors: summaries,
  }
}

/**
 * Formats a 1099 report into an IRS-ready CSV string for download and tax accountant handoff.
 */
export function format1099ReportCsv(report: Annual1099Report): string {
  const headers = [
    'Tax Year',
    'Contractor Name',
    'Business Name',
    'Tax ID (Last 4)',
    'Tax Classification',
    'Email',
    'Linked Vendor',
    'Form Type',
    'Box',
    'Total Compensation ($)',
    '1099 Required (>= $600)',
  ]

  const rows = report.contractors.map((c) => [
    report.taxYear,
    `"${c.contractorName.replace(/"/g, '""')}"`,
    `"${(c.businessName || '').replace(/"/g, '""')}"`,
    c.taxIdLast4 ? `***-**-${c.taxIdLast4}` : 'MISSING',
    c.taxClassification || 'unclassified',
    c.email || '',
    `"${(c.vendorName || '').replace(/"/g, '""')}"`,
    c.formType,
    `"${c.box}"`,
    c.totalPaid,
    c.meetsThreshold ? 'YES' : 'NO',
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}
