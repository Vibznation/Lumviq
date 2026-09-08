import { randomBytes } from 'crypto'

/**
 * Time-limited guest-access tokens for the customer invoice portal and
 * vendor bill-upload portal. Tokens are opaque random strings (not JWTs)
 * looked up directly against the token tables — no session state.
 */

function generateToken(): string {
  return randomBytes(24).toString('hex')
}

export async function createInvoicePortalToken(tx: any, invoiceId: string, expiresInDays = 30) {
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000)
  return tx.invoicePortalToken.create({ data: { invoiceId, token: generateToken(), expiresAt } })
}

export async function resolveInvoicePortalToken(tx: any, token: string) {
  const record = await tx.invoicePortalToken.findUnique({ where: { token } })
  if (!record) return null
  if (record.expiresAt < new Date()) return null
  const invoice = await tx.invoice.findUnique({
    where: { id: record.invoiceId },
    include: { lines: true, customer: true, organization: { select: { id: true, name: true } } },
  })
  return invoice
}

export async function createVendorUploadToken(tx: any, organizationId: string, vendorId: string, expiresInDays = 30) {
  const expiresAt = new Date(Date.now() + expiresInDays * 86400000)
  return tx.vendorUploadToken.create({ data: { organizationId, vendorId, token: generateToken(), expiresAt } })
}

export async function resolveVendorUploadToken(tx: any, token: string) {
  const record = await tx.vendorUploadToken.findUnique({ where: { token } })
  if (!record) return null
  if (record.expiresAt < new Date()) return null
  const vendor = await tx.vendor.findUnique({ where: { id: record.vendorId } })
  const organization = await tx.organization.findUnique({ where: { id: record.organizationId }, select: { id: true, name: true } })
  return { token: record, vendor, organization }
}
