import type { NextApiRequest, NextApiResponse } from 'next'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { markAllNotificationsRead } from '../../../lib/notifications'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { organizationId } = req.body || {}
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  await markAllNotificationsRead(organizationId, user.id)
  return res.status(200).json({ ok: true })
}
