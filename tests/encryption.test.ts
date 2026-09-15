import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encryptField, decryptField, maskLast4, last4 } from '../src/lib/encryption'

describe('encryption.ts', () => {
  const originalEnv = process.env.FIELD_ENCRYPTION_KEY
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = originalEnv
    ;(process.env as any).NODE_ENV = originalNodeEnv
  })

  it('round-trips a plaintext value through encryptField/decryptField', () => {
    const ciphertext = encryptField('123-45-6789')
    expect(ciphertext).not.toContain('123-45-6789')
    expect(decryptField(ciphertext)).toBe('123-45-6789')
  })

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const a = encryptField('routing-and-account-123456789')
    const b = encryptField('routing-and-account-123456789')
    expect(a).not.toBe(b)
    expect(decryptField(a)).toBe('routing-and-account-123456789')
    expect(decryptField(b)).toBe('routing-and-account-123456789')
  })

  it('throws when decrypting with a tampered ciphertext', () => {
    const ciphertext = encryptField('sensitive-value')
    const tampered = ciphertext.slice(0, -4) + (ciphertext.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA')
    expect(() => decryptField(tampered)).toThrow()
  })

  it('masks all but the last 4 digits', () => {
    expect(maskLast4('123456789')).toBe('••••6789')
    expect(maskLast4('12')).toBe('••••')
  })

  it('extracts last 4 digits', () => {
    expect(last4('123-45-6789')).toBe('6789')
    expect(last4('12')).toBe('12')
  })

  it('throws in production when FIELD_ENCRYPTION_KEY is not set', () => {
    ;(process.env as any).NODE_ENV = 'production'
    delete process.env.FIELD_ENCRYPTION_KEY
    expect(() => encryptField('x')).toThrow(/FIELD_ENCRYPTION_KEY/)
  })
})
