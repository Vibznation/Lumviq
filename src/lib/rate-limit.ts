import type { NextApiRequest } from 'next'

/**
 * Simple in-memory sliding-window rate limiter for auth endpoints
 * (login, register, invite acceptance). Suitable for a single Next.js
 * instance; in a multi-instance deployment this must be replaced with a
 * shared store (e.g. Redis) since each instance has its own memory — see
 * docs/security-notes.md.
 */
const buckets = new Map<string, { count: number; resetAt: number }>()

export function clientIp(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

/** Returns true if the request is allowed, false if it should be rejected with 429. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count += 1
  return true
}
