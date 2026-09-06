import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Job costing report: for each project, compares billable+non-billable
 * labor cost (hours * rate) and the project's budget against revenue
 * already invoiced via progress invoicing (time entries marked invoiced).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const projects = await prisma.project.findMany({ where: { organizationId }, include: { timeEntries: true, assignments: true } })

  const rows = projects.map((p) => {
    const cost = p.timeEntries.reduce((s, t) => s + Number(t.hours) * Number(t.rate || 0), 0)
    const billedHours = p.timeEntries.filter((t) => t.invoiced).reduce((s, t) => s + Number(t.hours), 0)
    const revenue = p.timeEntries.filter((t) => t.invoiced).reduce((s, t) => s + Number(t.hours) * Number(t.rate || 0), 0)
    return {
      projectId: p.id,
      name: p.name,
      status: p.status,
      budgetAmount: p.budgetAmount ? Number(p.budgetAmount) : null,
      totalHours: p.timeEntries.reduce((s, t) => s + Number(t.hours), 0),
      billedHours,
      laborCost: cost,
      revenueInvoiced: revenue,
      margin: revenue - cost,
      staffAssigned: p.assignments.length,
      overBudget: p.budgetAmount != null && cost > Number(p.budgetAmount),
    }
  })

  return res.status(200).json({ projects: rows, method: 'Labor cost = sum(hours * rate) per time entry; revenue = same, restricted to time entries already invoiced via progress invoicing.' })
}
