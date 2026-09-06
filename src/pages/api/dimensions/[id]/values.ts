import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { createDimensionValue } from '../../../../lib/dimensions'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const dimensionId = req.query.id as string
  const { name } = req.body || {}
  if (!name) return res.status(400).json({ error: 'name is required' })

  const dimension = await prisma.dimension.findUnique({ where: { id: dimensionId } })
  if (!dimension) return res.status(404).json({ error: 'Dimension not found' })
  if (!(await userHasMembership(user.id, dimension.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  try {
    const value = await prisma.$transaction((tx) => createDimensionValue(tx, dimensionId, name))
    return res.status(201).json(value)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
