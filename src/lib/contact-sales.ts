/**
 * Pure validation for the /contact-sales form, kept separate from the API
 * route so it can be unit tested without spinning up Prisma/Next.
 */
export interface ContactSalesInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  organizationName?: string
  organizationType?: string
  employeeCount?: string
  currentSystem?: string
  requiredModules?: string[]
  preferredContact?: string
  message?: string
  consentAcknowledged?: boolean
  /** Honeypot field: real users never fill this in. Bots that auto-fill every field will. */
  website?: string
}

export interface ValidationResult {
  ok: boolean
  errors: Record<string, string>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateContactSales(input: ContactSalesInput): ValidationResult {
  const errors: Record<string, string> = {}

  if (!input.firstName || !input.firstName.trim()) errors.firstName = 'First name is required'
  if (!input.lastName || !input.lastName.trim()) errors.lastName = 'Last name is required'
  if (!input.email || !input.email.trim()) errors.email = 'Business email is required'
  else if (!EMAIL_RE.test(input.email.trim())) errors.email = 'Enter a valid email address'
  if (!input.organizationName || !input.organizationName.trim()) errors.organizationName = 'Organization is required'
  if (!input.consentAcknowledged) errors.consentAcknowledged = 'Please acknowledge before submitting'

  // Spam prevention: honeypot field must stay empty.
  if (input.website && input.website.trim().length > 0) errors.website = 'Spam detected'

  for (const key of ['firstName', 'lastName', 'email', 'organizationName', 'phone', 'message'] as const) {
    const value = input[key]
    if (typeof value === 'string' && value.length > 2000) errors[key] = 'Value is too long'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}
