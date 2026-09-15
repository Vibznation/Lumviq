import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { nextCreditNoteNumber, postCreditNoteToLedger } from '../../../lib/invoicing'
import { enforceFeature } from '../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const creditNotes = await prisma.creditNote.findMany({
      where: { organizationId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(creditNotes)
  }

  if (req.method === 'POST') {
    const { organizationId, customerId, amount, reason, incomeAccountId } = req.body || {}
    if (!organizationId || !customerId || !amount || !incomeAccountId) {
      return res.status(400).json({ error: 'organizationId, customerId, amount and incomeAccountId are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceFeature(res, prisma, organizationId, 'sales.credit-notes'))) return

    const customer = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer || customer.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Customer does not belong to this organization' })
    }
    const account = await prisma.account.findUnique({ where: { id: incomeAccountId } })
    if (!account || account.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Income account does not belong to this organization' })
    }
    if (account.type !== 'income') {
      return res.status(400).json({ error: 'Credit notes must post to an income account' })
    }

    const creditNote = await prisma.$transaction(async (tx) => {
      const creditNumber = await nextCreditNoteNumber(tx, organizationId)
      const created = await tx.creditNote.create({
        data: { organizationId, customerId, creditNumber, amount, remainingAmount: amount, reason: reason || null, incomeAccountId },
      })
      await postCreditNoteToLedger(tx, created, user.id)
      return tx.creditNote.findUnique({ where: { id: created.id }, include: { customer: true } })
    })

    return res.status(201).json(creditNote)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
