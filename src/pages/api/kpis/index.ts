import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { evaluateKpi } from '../../../lib/kpis'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const kpis = await prisma.kpiDefinition.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } })
    const withValues = await Promise.all(
      kpis.map(async (kpi) => ({ ...kpi, value: await evaluateKpi(prisma, kpi) }))
    )
    return res.status(200).json(withValues)
  }

  if (req.method === 'POST') {
    const { organizationId, name, accountIds, operation, targetValue } = req.body || {}
    if (!organizationId || !name || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({ error: 'organizationId, name and at least one accountId are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const accounts = await prisma.account.findMany({ where: { id: { in: accountIds } } })
    if (accounts.some((a) => a.organizationId !== organizationId)) {
      return res.status(400).json({ error: 'One or more accounts do not belong to this organization' })
    }

    const kpi = await prisma.kpiDefinition.create({
      data: { organizationId, name, accountIds, operation: operation || 'sum', targetValue: targetValue ?? null },
    })
    return res.status(201).json(kpi)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
