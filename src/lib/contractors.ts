/**
 * 1099 contractor directory. A Contractor is a lightweight record for
 * tracking non-employee workers who need year-end 1099 totals; it may
 * optionally link to a Vendor record used for actual bill payments (the
 * money side of paying a contractor goes through the normal Vendor/Bill
 * flow — Contractor only tracks the tax-reporting identity).
 *
 * Lumviq does not generate or file 1099 forms — see
 * docs/known-limitations.md. This only tracks who should receive one.
 */
export async function createContractor(
  tx: any,
  params: { organizationId: string; name: string; email?: string | null; taxIdLast4?: string | null; vendorId?: string | null }
) {
  return tx.contractor.create({
    data: {
      organizationId: params.organizationId,
      name: params.name,
      email: params.email ?? null,
      taxIdLast4: params.taxIdLast4 ?? null,
      vendorId: params.vendorId ?? null,
    },
  })
}

/** Sums bill payments made to a contractor's linked vendor within a calendar year (for 1099 totals). */
export async function contractorYearTotal(tx: any, contractorId: string, year: number) {
  const contractor = await tx.contractor.findUnique({ where: { id: contractorId } })
  if (!contractor || !contractor.vendorId) return '0'
  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))
  const payments = await tx.billPayment.findMany({
    where: { bill: { vendorId: contractor.vendorId }, paymentDate: { gte: start, lt: end } },
  })
  let total = 0n
  const { toMinorUnits } = await import('./money')
  for (const p of payments) total += toMinorUnits(p.amount.toString())
  const { fromMinorUnits } = await import('./money')
  return fromMinorUnits(total)
}
