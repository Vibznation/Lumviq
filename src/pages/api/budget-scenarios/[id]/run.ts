import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { computeScenario, applyScenario } from '../../../../lib/budget-scenarios'

/** Body: { action: 'compute' | 'apply', year: number } */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const scenario = await prisma.budgetScenario.findUnique({ where: { id } })
  if (!scenario) return res.status(404).json({ error: 'Budget scenario not found' })
  if (!(await userHasMembership(user.id, scenario.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const { action, year } = req.body || {}
  if (!year) return res.status(400).json({ error: 'year is required' })
  if (!['compute', 'apply'].includes(action)) return res.status(400).json({ error: "action must be 'compute' or 'apply'" })

  if (action === 'compute') {
    const results = await computeScenario(prisma, { organizationId: scenario.organizationId, scenarioId: id, year })
    return res.status(200).json(results)
  }

  const budgets = await prisma.$transaction((tx) => applyScenario(tx, { organizationId: scenario.organizationId, scenarioId: id, year }))
  return res.status(200).json(budgets)
}
