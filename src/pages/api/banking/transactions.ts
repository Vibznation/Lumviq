import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const bankAccountId = req.query.bankAccountId as string | undefined
  if (bankAccountId) {
    const tx = await prisma.bankTransaction.findMany({ where: { bankAccountId }, orderBy: { transactionDate: 'desc' } })
    return res.status(200).json(tx)
  }
  // if sessionId provided, return transactions for the session's bank account
  const sessionId = req.query.sessionId as string | undefined
  if (sessionId) {
    const session = await prisma.reconciliationSession.findUnique({ where: { id: sessionId } })
    if (!session) return res.status(404).json([])
    const tx = await prisma.bankTransaction.findMany({ where: { bankAccountId: session.bankAccountId, transactionDate: { gte: session.startDate, lte: session.endDate } } })
    return res.status(200).json(tx)
  }
  return res.status(400).json({ error: 'bankAccountId or sessionId required' })
}
