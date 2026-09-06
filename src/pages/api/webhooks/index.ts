import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { createWebhook } from '../../../lib/webhooks'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const webhooks = await prisma.webhook.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } })
    // Never return the secret in list responses.
    return res.status(200).json(webhooks.map(({ secret, ...w }) => w))
  }

  if (req.method === 'POST') {
    const { organizationId, url, eventTypes } = req.body || {}
    if (!organizationId || !url || !Array.isArray(eventTypes) || eventTypes.length === 0) {
      return res.status(400).json({ error: 'organizationId, url and a non-empty eventTypes array are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    try {
      // eslint-disable-next-line no-new
      new URL(url)
    } catch {
      return res.status(400).json({ error: 'url must be a valid URL' })
    }
    const webhook = await prisma.$transaction((tx) => createWebhook(tx, { organizationId, url, eventTypes }))
    // Secret is only ever returned once, at creation time.
    return res.status(201).json(webhook)
  }

  return res.status(405).end()
}
