import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'please-set-a-secret'
const JWT_EXPIRES_IN = '7d'

export function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as any
  } catch (err) {
    return null
  }
}
