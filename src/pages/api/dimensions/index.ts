import type { NextApiRequest, NextApiResponse } from 'next'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { createDimension, listDimensionsWithValues } from '../../../lib/dimensions'
import prisma from '../../../server/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const dimensions = await listDimensionsWithValues(prisma, organizationId)
    return res.status(200).json(dimensions)
  }

  if (req.method === 'POST') {
    const { organizationId, name } = req.body || {}
    if (!organizationId || !name) return res.status(400).json({ error: 'organizationId and name are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    try {
      const dimension = await prisma.$transaction((tx) => createDimension(tx, organizationId, name))
      return res.status(201).json(dimension)
    } catch (err: any) {
      return res.status(400).json({ error: err.message })
    }
  }

  return res.status(405).end()
}
