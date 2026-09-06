import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const rates = await prisma.exchangeRate.findMany({ where: { organizationId }, orderBy: { asOfDate: 'desc' } })
    return res.status(200).json(rates)
  }

  if (req.method === 'POST') {
    const { organizationId, baseCurrency, quoteCurrency, rate, asOfDate } = req.body || {}
    if (!organizationId || !baseCurrency || !quoteCurrency || !rate || !asOfDate) {
      return res.status(400).json({ error: 'organizationId, baseCurrency, quoteCurrency, rate and asOfDate are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const created = await prisma.exchangeRate.create({
      data: { organizationId, baseCurrency, quoteCurrency, rate, asOfDate: new Date(asOfDate) },
    })
    return res.status(201).json(created)
  }

  return res.status(405).end()
}
