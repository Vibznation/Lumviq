import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { postBillPaymentToLedger } from '../../../../lib/purchasing'
import { toMinorUnits, fromMinorUnits } from '../../../../lib/money'

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
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.billPayment.create({
        data: {
          billId: bill.id,
          organizationId: bill.organizationId,
          amount,
          paymentDate: new Date(paymentDate),
          method: method || null,
          paymentAccountId,
        },
      })

      const entry = await postBillPaymentToLedger(tx, payment, bill.billNumber, user.id)
      await tx.billPayment.update({ where: { id: payment.id }, data: { journalEntryId: entry.id } })

      const newAmountPaidMinor = toMinorUnits(bill.amountPaid.toString()) + amountMinor
      const newStatus = newAmountPaidMinor >= toMinorUnits(bill.total.toString()) ? 'paid' : 'partially_paid'

      return tx.bill.update({
        where: { id: bill.id },
        data: { amountPaid: fromMinorUnits(newAmountPaidMinor), status: newStatus },
        include: { lines: true, vendor: true, payments: true },
      })
    })
    return res.status(201).json(result)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
