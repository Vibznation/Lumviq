import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { markNotificationRead } from '../../../../lib/notifications'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) return res.status(404).json({ error: 'Notification not found' })
  if (!(await userHasMembership(user.id, notification.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const updated = await markNotificationRead(id)
  return res.status(200).json(updated)
}
