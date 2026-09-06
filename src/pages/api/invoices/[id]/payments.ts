import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { postInvoicePaymentToLedger } from '../../../../lib/invoicing'
import { toMinorUnits, fromMinorUnits } from '../../../../lib/money'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const { amount, paymentDate, method, depositAccountId } = req.body || {}
  if (!amount || !paymentDate || !depositAccountId) {
    return res.status(400).json({ error: 'amount, paymentDate and depositAccountId are required' })
  }

  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  if (!(await userHasMembership(user.id, invoice.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (invoice.status === 'draft') return res.status(400).json({ error: 'Invoice must be sent before recording a payment' })
  if (invoice.voidedAt) return res.status(400).json({ error: 'Invoice has been voided' })

  const depositAccount = await prisma.account.findUnique({ where: { id: depositAccountId } })
  if (!depositAccount || depositAccount.organizationId !== invoice.organizationId) {
    return res.status(400).json({ error: 'Deposit account does not belong to this organization' })
  }

  const amountMinor = toMinorUnits(amount)
  if (amountMinor <= BigInt(0)) return res.status(400).json({ error: 'amount must be positive' })

  const outstandingMinor = toMinorUnits(invoice.total.toString()) - toMinorUnits(invoice.amountPaid.toString())
  if (amountMinor > outstandingMinor) {
    return res.status(400).json({ error: 'Payment amount exceeds outstanding invoice balance' })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          organizationId: invoice.organizationId,
          amount,
          paymentDate: new Date(paymentDate),
          method: method || null,
          depositAccountId,
        },
      })

      const entry = await postInvoicePaymentToLedger(tx, payment, invoice.invoiceNumber, user.id)
      await tx.invoicePayment.update({ where: { id: payment.id }, data: { journalEntryId: entry.id } })

      const newAmountPaidMinor = toMinorUnits(invoice.amountPaid.toString()) + amountMinor
      const newStatus = newAmountPaidMinor >= toMinorUnits(invoice.total.toString()) ? 'paid' : 'partially_paid'

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: fromMinorUnits(newAmountPaidMinor), status: newStatus },
        include: { lines: true, customer: true, payments: true },
      })

      return updatedInvoice
    })
    return res.status(201).json(result)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
