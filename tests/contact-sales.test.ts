import { describe, it, expect } from 'vitest'
import { validateContactSales } from '../src/lib/contact-sales'

const VALID = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  organizationName: 'Analytical Engines Inc.',
  consentAcknowledged: true,
}

describe('contact-sales.ts validateContactSales', () => {
  it('accepts a fully valid submission', () => {
    const result = validateContactSales(VALID)
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual({})
  })

  it('requires firstName, lastName, email, organizationName and consent', () => {
    const result = validateContactSales({})
    expect(result.ok).toBe(false)
    expect(result.errors.firstName).toBeTruthy()
    expect(result.errors.lastName).toBeTruthy()
    expect(result.errors.email).toBeTruthy()
    expect(result.errors.organizationName).toBeTruthy()
    expect(result.errors.consentAcknowledged).toBeTruthy()
  })

  it('treats whitespace-only required fields as missing', () => {
    const result = validateContactSales({ ...VALID, firstName: '   ' })
    expect(result.ok).toBe(false)
    expect(result.errors.firstName).toBeTruthy()
  })

  it('rejects malformed email addresses', () => {
    const result = validateContactSales({ ...VALID, email: 'not-an-email' })
    expect(result.ok).toBe(false)
    expect(result.errors.email).toBeTruthy()
  })

  it('rejects submissions where the honeypot field is filled in', () => {
    const result = validateContactSales({ ...VALID, website: 'https://spammy-bot.example' })
    expect(result.ok).toBe(false)
    expect(result.errors.website).toBeTruthy()
  })

  it('allows an empty honeypot field', () => {
    const result = validateContactSales({ ...VALID, website: '' })
    expect(result.ok).toBe(true)
  })

  it('rejects fields exceeding the max length guard', () => {
    const result = validateContactSales({ ...VALID, message: 'x'.repeat(2001) })
    expect(result.ok).toBe(false)
    expect(result.errors.message).toBeTruthy()
  })

  it('accepts fields right at the max length boundary', () => {
    const result = validateContactSales({ ...VALID, message: 'x'.repeat(2000) })
    expect(result.ok).toBe(true)
  })

  it('does not require optional fields like phone, organizationType or requiredModules', () => {
    const result = validateContactSales({ ...VALID, phone: undefined, requiredModules: undefined })
    expect(result.ok).toBe(true)
  })
})
