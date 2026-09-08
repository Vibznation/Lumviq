import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { postReimbursementToLedger } from '../../../../lib/reimbursements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const { decision, paymentAccountId } = req.body || {}
  if (!['approve', 'reject', 'pay'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approve, reject or pay' })
  }

  const reimbursement = await prisma.reimbursement.findUnique({ where: { id } })
  if (!reimbursement) return res.status(404).json({ error: 'Reimbursement not found' })
  if (!(await userHasMembership(user.id, reimbursement.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (decision === 'approve') {
    if (reimbursement.status !== 'pending') return res.status(400).json({ error: 'Only a pending reimbursement can be approved' })
    const updated = await prisma.reimbursement.update({ where: { id }, data: { status: 'approved' } })
    return res.status(200).json(updated)
  }
  if (decision === 'reject') {
    if (reimbursement.status === 'paid') return res.status(400).json({ error: 'A paid reimbursement cannot be rejected' })
    const updated = await prisma.reimbursement.update({ where: { id }, data: { status: 'rejected' } })
    return res.status(200).json(updated)
  }
  // pay
  if (reimbursement.status !== 'approved') return res.status(400).json({ error: 'Only an approved reimbursement can be paid' })
  if (!paymentAccountId) return res.status(400).json({ error: 'paymentAccountId is required to pay' })
  const account = await prisma.account.findUnique({ where: { id: paymentAccountId } })
  if (!account || account.organizationId !== reimbursement.organizationId) {
    return res.status(400).json({ error: 'Payment account does not belong to this organization' })
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.reimbursement.update({ where: { id }, data: { paymentAccountId } })
    const withAccount = await tx.reimbursement.findUnique({ where: { id }, include: { lines: true } })
    await postReimbursementToLedger(tx, withAccount, user.id)
    return tx.reimbursement.findUnique({ where: { id } })
  })
  return res.status(200).json(result)
}
