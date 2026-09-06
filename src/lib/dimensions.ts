/**
 * Dimensions (a.k.a. classes/departments/locations/programs) let journal
 * lines be tagged with an extra reporting axis beyond the chart of
 * accounts, per prompt.md's ARCHITECTURE requirement for dimension-based
 * reporting. A Dimension is a named axis (e.g. "Department"); each
 * DimensionValue is one tag within it (e.g. "Sales", "Engineering").
 *
 * Only manual journal entries currently support tagging a line with a
 * dimension value (see src/pages/api/journal/entries/index.ts) — invoice,
 * bill and payroll lines are not yet taggable. See docs/known-limitations.md.
 */
export async function createDimension(tx: any, organizationId: string, name: string) {
  return tx.dimension.create({ data: { organizationId, name } })
}

export async function createDimensionValue(tx: any, dimensionId: string, name: string) {
  return tx.dimensionValue.create({ data: { dimensionId, name } })
}

export async function listDimensionsWithValues(tx: any, organizationId: string) {
  return tx.dimension.findMany({
    where: { organizationId },
    include: { values: { orderBy: { name: 'asc' } } },
    orderBy: { name: 'asc' },
  })
}
