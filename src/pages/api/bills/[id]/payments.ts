import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { createAndPostBillPayment } from '../../../../lib/purchasing'
import { toMinorUnits } from '../../../../lib/money'
import { amountRequiresApproval, requestApproval } from '../../../../lib/approvals'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const { amount, paymentDate, method, paymentAccountId } = req.body || {}
  if (!amount || !paymentDate || !paymentAccountId) {
    return res.status(400).json({ error: 'amount, paymentDate and paymentAccountId are required' })
  }

  const bill = await prisma.bill.findUnique({ where: { id } })
  if (!bill) return res.status(404).json({ error: 'Bill not found' })
  if (!(await userHasMembership(user.id, bill.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (bill.status === 'draft') return res.status(400).json({ error: 'Bill must be sent before recording a payment' })
  if (bill.voidedAt) return res.status(400).json({ error: 'Bill has been voided' })

  const paymentAccount = await prisma.account.findUnique({ where: { id: paymentAccountId } })
  if (!paymentAccount || paymentAccount.organizationId !== bill.organizationId) {
    return res.status(400).json({ error: 'Payment account does not belong to this organization' })
  }

  const amountMinor = toMinorUnits(amount)
  if (amountMinor <= BigInt(0)) return res.status(400).json({ error: 'amount must be positive' })

  const outstandingMinor = toMinorUnits(bill.total.toString()) - toMinorUnits(bill.amountPaid.toString())
  if (amountMinor > outstandingMinor) {
    return res.status(400).json({ error: 'Payment amount exceeds outstanding bill balance' })
  }

  try {
    if (amountRequiresApproval('bill-payment', Number(amount))) {
      const approval = await prisma.$transaction((tx) =>
        requestApproval(tx, {
          organizationId: bill.organizationId,
          resourceType: 'bill-payment',
          resourceId: bill.id,
          amount,
          payload: { amount, paymentDate, method: method || null, paymentAccountId },
          requestedByUserId: user.id,
          note: `Payment for bill ${bill.billNumber}`,
        })
      )
      return res.status(202).json({ requiresApproval: true, approval })
    }

    const result = await prisma.$transaction((tx) =>
      createAndPostBillPayment(tx, bill, { amount, paymentDate, method: method || null, paymentAccountId }, user.id)
    )
    return res.status(201).json(result)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}

