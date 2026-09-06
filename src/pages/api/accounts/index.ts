import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const accounts = await prisma.account.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    })
    return res.status(200).json(accounts)
  }

  if (req.method === 'POST') {
    const { organizationId, code, name, type, subtype } = req.body || {}
    if (!organizationId || !code || !name || !type) {
      return res.status(400).json({ error: 'organizationId, code, name and type are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const validTypes = ['asset', 'liability', 'equity', 'income', 'expense']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${validTypes.join(', ')}` })
    }
    const existing = await prisma.account.findFirst({ where: { organizationId, code } })
    if (existing) return res.status(409).json({ error: 'An account with this code already exists' })

    const account = await prisma.account.create({
      data: { organizationId, code, name, type, subtype: subtype || null },
    })
    await prisma.auditEvent.create({
      data: {
        organizationId,
        actorId: user.id,
        action: 'create_account',
        resourceType: 'account',
        resourceId: account.id,
        newState: { code, name, type, subtype: subtype || null },
      },
    })
    return res.status(201).json(account)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
