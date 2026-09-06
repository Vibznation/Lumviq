import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { sessionId, bankTransactionId, journalLineId } = req.body
  if (!sessionId || !bankTransactionId || !journalLineId) return res.status(400).json({ error: 'sessionId, bankTransactionId and journalLineId required' })
  // RBAC check
  const session = await prisma.reconciliationSession.findUnique({ where: { id: sessionId } })
  if (!session) return res.status(404).json({ error: 'session not found' })
  try { await requireMembershipOrThrow(user.id, session.organizationId) } catch (e:any) { return res.status(403).json({ error: 'Not a member' }) }
  const hasPerm = await userHasPermission(user.id, session.organizationId, 'bank.reconcile')
  if (!hasPerm) return res.status(403).json({ error: 'Insufficient permissions' })

  // perform transactional apply with lock
  let item: any = null
  try {
    await prisma.$transaction(async (tx) => {
      const rows: any = await tx.$queryRaw`SELECT is_cleared FROM bank_transactions WHERE id = ${bankTransactionId} FOR UPDATE`
      const isCleared = rows && rows[0] && (rows[0].is_cleared === true || rows[0].is_cleared === 't')
      if (isCleared) return
      item = await tx.reconciliationItem.create({ data: { sessionId, bankTransactionId, matched: true, matchedToJournalLineId: journalLineId } })
      await tx.bankTransaction.update({ where: { id: bankTransactionId }, data: { isCleared: true } })
      await tx.auditEvent.create({ data: { organizationId: session.organizationId, actorId: user.id, action: 'bank.reconciliation.match', resourceType: 'reconciliation_item', resourceId: item.id, newState: { bankTransactionId, journalLineId, sessionId }, previousState: null } })
    })
  } catch (e) {
    console.error('apply error', e)
  }

  if (!item) return res.status(409).json({ error: 'Transaction already matched or concurrent apply' })
  return res.status(201).json(item)
}
