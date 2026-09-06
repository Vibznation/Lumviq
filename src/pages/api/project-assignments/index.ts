import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    const projectId = req.query.projectId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const assignments = await prisma.projectAssignment.findMany({
      where: { organizationId, ...(projectId ? { projectId } : {}) },
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(assignments)
  }

  if (req.method === 'POST') {
    const { organizationId, projectId, userId, allocationPercent, roleLabel } = req.body || {}
    if (!organizationId || !projectId || !userId) {
      return res.status(400).json({ error: 'organizationId, projectId and userId are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project || project.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Project does not belong to this organization' })
    }
    if (!(await userHasMembership(userId, organizationId))) {
      return res.status(400).json({ error: 'Assigned user is not a member of this organization' })
    }

    const assignment = await prisma.projectAssignment.create({
      data: { organizationId, projectId, userId, allocationPercent: allocationPercent ?? 100, roleLabel: roleLabel || null },
    })
    return res.status(201).json(assignment)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
