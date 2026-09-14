import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../server/prisma'

export interface StatusComponent {
  name: string
  status: 'operational' | 'degraded' | 'down'
  detail?: string
}

export interface StatusResponse {
  overall: 'operational' | 'degraded' | 'down'
  checkedAt: string
  components: StatusComponent[]
}

/**
 * Public, unauthenticated system status endpoint. Performs a real
 * connectivity check against the database rather than returning a
 * hardcoded "all systems operational" — if the DB check fails, the
 * response honestly reports degraded/down status. Backs src/pages/status.tsx.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse<StatusResponse>) {
  const components: StatusComponent[] = [
    { name: 'Application', status: 'operational' }, // this request completing at all proves the app is serving traffic
  ]

  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const ms = Date.now() - dbStart
    components.push({
      name: 'Database',
      status: ms < 2000 ? 'operational' : 'degraded',
      detail: `Responded in ${ms}ms`,
    })
  } catch (err: any) {
    components.push({ name: 'Database', status: 'down', detail: 'Could not reach the database' })
  }

  const overall: StatusResponse['overall'] = components.some((c) => c.status === 'down')
    ? 'down'
    : components.some((c) => c.status === 'degraded')
    ? 'degraded'
    : 'operational'

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ overall, checkedAt: new Date().toISOString(), components })
}
