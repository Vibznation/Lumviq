import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { createProgram } from '../../../../lib/nonprofit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const programs = await prisma.program.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
    return res.status(200).json(programs)
  }

  if (req.method === 'POST') {
    const { organizationId, name, description } = req.body || {}
    if (!organizationId || !name) return res.status(400).json({ error: 'organizationId and name are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const program = await prisma.$transaction((tx) => createProgram(tx, { organizationId, name, description }))
    return res.status(201).json(program)
  }

  return res.status(405).end()
}
