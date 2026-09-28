import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceFeature } from '../../../lib/entitlements'
import { getFxRateProvider } from '../../../lib/integrations/fx'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { organizationId, baseCurrency = 'USD', targetCurrencies = ['EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF'] } = req.body || {}
  if (!organizationId) return res.status(400).json({ error: 'organizationId required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceFeature(res, prisma, organizationId, 'settings.currencies'))) return

  const provider = getFxRateProvider()
  if (!provider) {
    return res.status(503).json({ error: 'No FX rate provider is configured' })
  }

  try {
    const quotes = await provider.getLatestRates(baseCurrency, targetCurrencies)
    const saved = []

    for (const q of quotes) {
      const rec = await prisma.exchangeRate.create({
        data: {
          organizationId,
          baseCurrency: q.baseCurrency,
          quoteCurrency: q.quoteCurrency,
          rate: q.rate,
          asOfDate: q.asOfDate,
        },
      })
      saved.push(rec)
    }

    return res.status(200).json({
      provider: provider.name,
      syncedCount: saved.length,
      rates: saved,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to sync exchange rates' })
  }
}
