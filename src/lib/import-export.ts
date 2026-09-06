import { z } from 'zod'

/**
 * Generic CSV import/export for customers, vendors and chart-of-accounts,
 * per prompt.md's DATA IMPORT AND EXPORT requirement (templates, mapping,
 * validation, preview, dry-run, rollback, import history). Invoices,
 * bills, bank transactions and journal entries are not yet supported by
 * this generic importer — banking CSV import already exists separately
 * (see src/pages/banking/import.tsx) and is not affected by this module.
 *
 * "Rollback" here means: a dry-run import creates nothing, so discarding
 * its result requires no action. A committed (non-dry-run) import is not
 * automatically reversible — deleting the created records is a manual
 * follow-up. See docs/known-limitations.md.
 */

export type ImportEntityType = 'customers' | 'vendors' | 'accounts'

const customerRowSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  billingAddress: z.string().optional(),
})

const vendorRowSchema = z.object({
  name: z.string().min(1, 'name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
})

const accountRowSchema = z.object({
  code: z.string().min(1, 'code is required'),
  name: z.string().min(1, 'name is required'),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  subtype: z.string().optional(),
})

export const IMPORT_TEMPLATES: Record<ImportEntityType, { columns: string[]; schema: z.ZodTypeAny }> = {
  customers: { columns: ['name', 'email', 'phone', 'billingAddress'], schema: customerRowSchema },
  vendors: { columns: ['name', 'email', 'phone', 'address'], schema: vendorRowSchema },
  accounts: { columns: ['code', 'name', 'type', 'subtype'], schema: accountRowSchema },
}

export interface ImportRowResult {
  row: number
  ok: boolean
  error?: string
  data?: Record<string, string>
}

/** Validates parsed CSV rows against the entity's schema. Never touches the database (used for both dry-run preview and pre-commit validation). */
export function validateImportRows(entityType: ImportEntityType, rows: Record<string, string>[]): ImportRowResult[] {
  const { schema } = IMPORT_TEMPLATES[entityType]
  return rows.map((row, index) => {
    const parsed = schema.safeParse(row)
    if (!parsed.success) {
      return { row: index + 1, ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') }
    }
    return { row: index + 1, ok: true, data: row }
  })
}

/** Commits validated rows for one entity type inside a transaction, skipping any row that failed validation. */
export async function commitImportRows(tx: any, organizationId: string, entityType: ImportEntityType, validated: ImportRowResult[]) {
  let successCount = 0
  const errors: ImportRowResult[] = []
  for (const result of validated) {
    if (!result.ok || !result.data) {
      errors.push(result)
      continue
    }
    try {
      if (entityType === 'customers') {
        await tx.customer.create({ data: { organizationId, name: result.data.name, email: result.data.email || null, phone: result.data.phone || null, billingAddress: result.data.billingAddress || null } })
      } else if (entityType === 'vendors') {
        await tx.vendor.create({ data: { organizationId, name: result.data.name, email: result.data.email || null, phone: result.data.phone || null, address: result.data.address || null } })
      } else if (entityType === 'accounts') {
        await tx.account.create({ data: { organizationId, code: result.data.code, name: result.data.name, type: result.data.type, subtype: result.data.subtype || null } })
      }
      successCount += 1
    } catch (err: any) {
      errors.push({ row: result.row, ok: false, error: err.message })
    }
  }
  return { successCount, errorCount: errors.length, errors }
}

/** Builds a CSV export string for one entity type. */
export function toCsv(columns: string[], rows: Record<string, any>[]): string {
  const escape = (value: any) => {
    const str = value == null ? '' : String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }
  const lines = [columns.join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => escape(row[c])).join(','))
  }
  return lines.join('\n')
}
