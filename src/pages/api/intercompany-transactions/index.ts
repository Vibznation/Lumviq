import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { postIntercompanyTransaction } from '../../../lib/consolidation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const transactions = await prisma.intercompanyTransaction.findMany({
      where: { OR: [{ organizationId }, { counterpartyOrganizationId: organizationId }] },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(transactions)
  }

  if (req.method === 'POST') {
    const {
      organizationId,
      counterpartyOrganizationId,
      description,
      amount,
      dueFromAccountId,
      dueToAccountId,
      organizationOffsetAccountId,
      counterpartyOffsetAccountId,
    } = req.body || {}
    if (!organizationId || !counterpartyOrganizationId || amount == null || !dueFromAccountId || !dueToAccountId || !organizationOffsetAccountId || !counterpartyOffsetAccountId) {
      return res.status(400).json({
        error:
          'organizationId, counterpartyOrganizationId, amount, dueFromAccountId, dueToAccountId, organizationOffsetAccountId and counterpartyOffsetAccountId are required',
      })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const counterparty = await prisma.organization.findUnique({ where: { id: counterpartyOrganizationId } })
    if (!counterparty || (counterparty.parentOrganizationId !== organizationId && counterparty.id !== organizationId)) {
      const org = await prisma.organization.findUnique({ where: { id: organizationId } })
      if (!org || org.parentOrganizationId !== counterpartyOrganizationId) {
        return res.status(400).json({ error: 'Organizations must be linked as parent/child to record an intercompany transaction' })
      }
    }

    try {
      const record = await prisma.$transaction((tx) =>
        postIntercompanyTransaction(
          tx,
          { organizationId, counterpartyOrganizationId, description, amount: amount.toString(), dueFromAccountId, dueToAccountId, organizationOffsetAccountId, counterpartyOffsetAccountId },
          user.id
        )
      )
      return res.status(201).json(record)
    } catch (err: any) {
      return res.status(400).json({ error: err.message })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
