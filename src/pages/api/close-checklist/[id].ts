import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const item = await prisma.closeChecklistItem.findUnique({ where: { id } })
  if (!item) return res.status(404).json({ error: 'Checklist item not found' })
  if (!(await userHasMembership(user.id, item.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'PATCH') {
    const { status, notes, assignedToUserId } = req.body || {}
    const data: any = {}
    if (status) {
      data.status = status
      data.completedAt = status === 'complete' ? new Date() : null
    }
    if (notes !== undefined) data.notes = notes
    if (assignedToUserId !== undefined) data.assignedToUserId = assignedToUserId
    const updated = await prisma.closeChecklistItem.update({ where: { id }, data })
    return res.status(200).json(updated)
  }

  res.setHeader('Allow', 'PATCH')
  return res.status(405).end()
}
