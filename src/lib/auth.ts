import jwt from 'jsonwebtoken'

const JWT_EXPIRES_IN = '7d'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || 'please-set-a-secret'
  return secret.trim().replace(/^["']|["']$/g, '').replace(/\\r\\n$|\\n$|\\r$/, '')
}

export function signToken(payload: object) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, getJwtSecret()) as any
  } catch (err) {
    return null
  }
}
