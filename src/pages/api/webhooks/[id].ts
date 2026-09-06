import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const webhook = await prisma.webhook.findUnique({ where: { id } })
  if (!webhook) return res.status(404).json({ error: 'Webhook not found' })
  if (!(await userHasMembership(user.id, webhook.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  await prisma.webhook.delete({ where: { id } })
  return res.status(204).end()
}
