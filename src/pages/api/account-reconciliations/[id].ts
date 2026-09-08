import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { clearLines, unclearLines, completeReconciliation } from '../../../lib/account-reconciliation'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const reconciliation = await prisma.accountReconciliation.findUnique({ where: { id } })
  if (!reconciliation) return res.status(404).json({ error: 'Reconciliation not found' })
  if (!(await userHasMembership(user.id, reconciliation.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    const clearedLines = await prisma.journalLine.findMany({ where: { accountReconciliationId: id }, include: { journalEntry: true } })
    return res.status(200).json({ ...reconciliation, clearedLines })
  }

  if (req.method === 'PATCH') {
    const { action, journalLineIds } = req.body || {}
    if (action === 'clear') {
      if (!Array.isArray(journalLineIds) || journalLineIds.length === 0) {
        return res.status(400).json({ error: 'journalLineIds is required' })
      }
      await clearLines(prisma, id, journalLineIds)
      return res.status(200).json({ ok: true })
    }
    if (action === 'unclear') {
      if (!Array.isArray(journalLineIds) || journalLineIds.length === 0) {
        return res.status(400).json({ error: 'journalLineIds is required' })
      }
      await unclearLines(prisma, journalLineIds)
      return res.status(200).json({ ok: true })
    }
    if (action === 'complete') {
      try {
        const completed = await prisma.$transaction((tx) => completeReconciliation(tx, id, user.id))
        return res.status(200).json(completed)
      } catch (err: any) {
        return res.status(409).json({ error: err.message })
      }
    }
    return res.status(400).json({ error: 'Unknown action; expected clear, unclear or complete' })
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).end()
}
