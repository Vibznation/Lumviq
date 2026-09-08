import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { postNextLoanPayment } from '../../../../lib/loans'

/** Posts the next scheduled loan payment. Body: { paymentAccountId } */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const loan = await prisma.loan.findUnique({ where: { id } })
  if (!loan) return res.status(404).json({ error: 'Loan not found' })
  if (!(await userHasMembership(user.id, loan.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const { paymentAccountId } = req.body || {}
  const account = paymentAccountId || loan.disbursementAccountId
  if (!account) return res.status(400).json({ error: 'paymentAccountId is required (no default disbursementAccountId on this loan)' })

  const payment = await prisma.$transaction((tx) => postNextLoanPayment(tx, id, user.id, account))
  if (!payment) return res.status(200).json({ message: 'Loan is fully paid off' })
  return res.status(201).json(payment)
}
