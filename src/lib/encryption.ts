/**
 * Field-level encryption for payroll PII (SSNs, bank account/routing
 * numbers). AES-256-GCM via Node's built-in `crypto` — no external
 * dependency, consistent with the rest of Lumviq's integration code
 * (see src/lib/webhooks.ts for the same "use Node crypto, nothing
 * fancier" convention).
 *
 * SECURITY NOTE: `FIELD_ENCRYPTION_KEY` must be set in production. If it
 * is not, encryption calls throw rather than silently falling back to a
 * weak/shared key — sensitive fields must never be persisted in
 * plaintext or under a guessable key. A deterministic development-only
 * key is used outside production so local dev/tests don't require extra
 * setup.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const secret = process.env.FIELD_ENCRYPTION_KEY
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FIELD_ENCRYPTION_KEY must be set to store or read encrypted payroll fields (SSNs, bank account numbers) in production'
      )
    }
    return scryptSync('lumviq-dev-only-insecure-key', 'lumviq-dev-salt', 32)
  }
  return scryptSync(secret, 'lumviq-field-encryption-v1', 32)
}

/** Encrypts a plaintext string (e.g. SSN, bank account number). */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

/** Decrypts a string previously produced by encryptField(). */
export function decryptField(ciphertext: string): string {
  const raw = Buffer.from(ciphertext, 'base64')
  const iv = raw.subarray(0, IV_LENGTH)
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/** Returns "••••1234"-style masked value for display, given a raw digit string. */
export function maskLast4(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '')
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : '••••'
}

/** Extracts just the last 4 digits (for storage in a *Last4 column). */
export function last4(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '')
  return digits.slice(-4)
}
