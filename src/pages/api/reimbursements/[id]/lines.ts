import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { addReimbursementLine } from '../../../../lib/reimbursements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const reimbursement = await prisma.reimbursement.findUnique({ where: { id } })
  if (!reimbursement) return res.status(404).json({ error: 'Reimbursement not found' })
  if (!(await userHasMembership(user.id, reimbursement.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    const lines = await prisma.reimbursementLine.findMany({ where: { reimbursementId: id }, orderBy: { date: 'asc' } })
    return res.status(200).json(lines)
  }

  if (req.method === 'POST') {
    const { date, description, amount, expenseAccountId, documentId } = req.body || {}
    if (!date || !description || amount == null || !expenseAccountId) {
      return res.status(400).json({ error: 'date, description, amount and expenseAccountId are required' })
    }
    const account = await prisma.account.findUnique({ where: { id: expenseAccountId } })
    if (!account || account.organizationId !== reimbursement.organizationId) {
      return res.status(400).json({ error: 'Expense account does not belong to this organization' })
    }
    const updated = await prisma.$transaction((tx) =>
      addReimbursementLine(tx, id, { date: new Date(date), description, amount: amount.toString(), expenseAccountId, documentId })
    )
    return res.status(201).json(updated)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
