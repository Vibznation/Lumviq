import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

const VALID_CASH_FLOW_CATEGORIES = ['operating', 'investing', 'financing']

/** GET a single account; PATCH updates safe/non-structural fields (subtype, cashFlowCategory). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const account = await prisma.account.findUnique({ where: { id } })
  if (!account) return res.status(404).json({ error: 'Account not found' })
  if (!(await userHasMembership(user.id, account.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    return res.status(200).json(account)
  }

  if (req.method === 'PATCH') {
    const { subtype, cashFlowCategory } = req.body || {}
    if (cashFlowCategory !== undefined && cashFlowCategory !== null && !VALID_CASH_FLOW_CATEGORIES.includes(cashFlowCategory)) {
      return res.status(400).json({ error: `cashFlowCategory must be one of ${VALID_CASH_FLOW_CATEGORIES.join(', ')}` })
    }
    const data: any = {}
    if (subtype !== undefined) data.subtype = subtype || null
    if (cashFlowCategory !== undefined) data.cashFlowCategory = cashFlowCategory || null

    const updated = await prisma.account.update({ where: { id }, data })
    await prisma.auditEvent.create({
      data: {
        organizationId: account.organizationId,
        actorId: user.id,
        action: 'update_account',
        resourceType: 'account',
        resourceId: account.id,
        newState: data,
      },
    })
    return res.status(200).json(updated)
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).end()
}
