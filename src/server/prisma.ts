import { PrismaClient } from '@prisma/client'

export function sanitizeDatabaseUrl(rawUrl?: string): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl

  let url = rawUrl.trim()
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim()
  }
  url = url.replace(/\\r\\n$|\\n$|\\r$/, '').trim()

  const protocolIdx = url.indexOf('://')
  const lastAtIdx = url.lastIndexOf('@')

  if (protocolIdx !== -1 && lastAtIdx !== -1 && lastAtIdx > protocolIdx + 3) {
    const protocol = url.slice(0, protocolIdx + 3)
    const authPart = url.slice(protocolIdx + 3, lastAtIdx)
    const hostAndRest = url.slice(lastAtIdx)

    const colonIdx = authPart.indexOf(':')
    if (colonIdx !== -1) {
      const user = authPart.slice(0, colonIdx)
      let pass = authPart.slice(colonIdx + 1)
      if (pass.startsWith('[') && pass.endsWith(']')) {
        pass = pass.slice(1, -1)
      }
      try {
        pass = decodeURIComponent(pass)
      } catch (_) {}
      const encodedPass = encodeURIComponent(pass)
      url = `${protocol}${user}:${encodedPass}${hostAndRest}`
    }
  }

  return url
}

// Ensure process.env is sanitized before Prisma loads it
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = sanitizeDatabaseUrl(process.env.DATABASE_URL)
}
if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = sanitizeDatabaseUrl(process.env.DIRECT_URL)
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

const clientUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL)
const prisma =
  global.prisma ??
  (clientUrl
    ? new PrismaClient({ datasources: { db: { url: clientUrl } } })
    : new PrismaClient())

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export default prisma
