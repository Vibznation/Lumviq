import type { NextApiRequest, NextApiResponse } from 'next'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { getBankFeedProvider } from '../../../lib/integrations/bank-feed'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })

  if (!(await userHasMembership(user.id, organizationId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const provider = getBankFeedProvider()
  if (!provider || !provider.isConfigured()) {
    return res.status(503).json({ error: 'Bank feed provider is not connected or configured' })
  }

  try {
    const accounts = await provider.listAccounts(organizationId)
    return res.status(200).json({
      provider: provider.name,
      accounts,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list bank feed accounts' })
  }
}
