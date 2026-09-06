import type { NextApiRequest, NextApiResponse } from 'next'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { listNotifications, unreadNotificationCount } from '../../../lib/notifications'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).end()

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const unreadOnly = req.query.unreadOnly === 'true'
  const [notifications, unreadCount] = await Promise.all([
    listNotifications(organizationId, user.id, { unreadOnly }),
    unreadNotificationCount(organizationId, user.id),
  ])
  return res.status(200).json({ notifications, unreadCount })
}
