import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceFeature } from '../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    const projectId = req.query.projectId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const entries = await prisma.timeEntry.findMany({
      where: { organizationId, ...(projectId ? { projectId } : {}) },
      orderBy: { date: 'desc' },
    })
    return res.status(200).json(entries)
  }

  if (req.method === 'POST') {
    const { organizationId, projectId, date, hours, billable, rate, description } = req.body || {}
    if (!organizationId || !projectId || !date || hours == null) {
      return res.status(400).json({ error: 'organizationId, projectId, date and hours are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceFeature(res, prisma, organizationId, 'projects.time-tracking'))) return

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project || project.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Project does not belong to this organization' })
    }

    const entry = await prisma.timeEntry.create({
      data: {
        organizationId,
        projectId,
        userId: user.id,
        date: new Date(date),
        hours,
        billable: billable !== false,
        rate: rate || null,
        description: description || null,
      },
    })
    return res.status(201).json(entry)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
