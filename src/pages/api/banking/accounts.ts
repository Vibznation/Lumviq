import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceFeature } from '../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const accounts = await prisma.bankAccount.findMany({ where: { organizationId }, orderBy: { createdAt: 'asc' } })
    return res.status(200).json(accounts)
  }

  if (req.method === 'POST') {
    const { organizationId, name, provider, accountNumber, currency, accountId } = req.body || {}
    if (!organizationId || !name) return res.status(400).json({ error: 'organizationId and name are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceFeature(res, prisma, organizationId, 'accounting.bank-reconciliation'))) return
    if (accountId) {
      const linkedAccount = await prisma.account.findUnique({ where: { id: accountId } })
      if (!linkedAccount || linkedAccount.organizationId !== organizationId) {
        return res.status(400).json({ error: 'accountId does not belong to this organization' })
      }
    }
    const account = await prisma.bankAccount.create({
      data: { organizationId, name, provider: provider || 'csv', accountNumber: accountNumber || null, currency: currency || 'USD', accountId: accountId || null },
    })
    return res.status(201).json(account)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
