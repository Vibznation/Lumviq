import type { NextApiRequest, NextApiResponse } from 'next'
import { requireUserFromRequest } from '../../../lib/authorization'
import { isProviderConnected } from '../../../lib/payroll-run'

/**
 * Reports whether a payroll provider is connected server-side, and
 * whether it's the sandbox (test-mode) implementation. Never claims a
 * live connection unless PAYROLL_PROVIDER_MODE is actually set — see
 * src/lib/integrations/payroll-sandbox.ts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const connected = isProviderConnected()
  const rawMode = process.env.PAYROLL_PROVIDER_MODE
  const mode = rawMode === 'sandbox' ? 'sandbox' : rawMode === 'check' && connected ? 'check' : 'none'
  return res.status(200).json({ connected, mode })
}
