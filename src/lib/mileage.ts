/**
 * Mileage tracking (Lumviq Start and higher). Records business-travel
 * mileage log entries for tax-deduction / reimbursement purposes. This
 * is a directory/log only — Lumviq does not calculate tax deductions or
 * automatically create a Reimbursement; a mileage log can optionally be
 * linked to an existing Reimbursement once one has been created for it.
 * See docs/known-limitations.md.
 */

/** Reimbursable amount for a mileage entry, rounded to cents. */
export function mileageAmount(miles: number, ratePerMile: number): number {
  return Math.round(miles * ratePerMile * 100) / 100
}
