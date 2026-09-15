import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { postInvoiceRefundToLedger } from '../../../lib/invoicing'
import { toMinorUnits, fromMinorUnits } from '../../../lib/money'
import { enforceFeature } from '../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const refunds = await prisma.invoiceRefund.findMany({
      where: { organizationId },
      include: { invoice: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(refunds)
  }

  if (req.method === 'POST') {
    const { organizationId, invoiceId, amount, refundDate, reason, depositAccountId } = req.body || {}
    if (!organizationId || !invoiceId || !amount || !refundDate || !depositAccountId) {
      return res.status(400).json({ error: 'organizationId, invoiceId, amount, refundDate and depositAccountId are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceFeature(res, prisma, organizationId, 'sales.refunds'))) return

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice || invoice.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Invoice does not belong to this organization' })
    }
    const account = await prisma.account.findUnique({ where: { id: depositAccountId } })
    if (!account || account.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Deposit account does not belong to this organization' })
    }

    const amountMinor = toMinorUnits(amount)
    if (amountMinor <= BigInt(0)) return res.status(400).json({ error: 'Refund amount must be positive' })
    const alreadyRefunded = await prisma.invoiceRefund.aggregate({ where: { invoiceId }, _sum: { amount: true } })
    const refundedSoFarMinor = toMinorUnits((alreadyRefunded._sum.amount ?? 0).toString())
    const amountPaidMinor = toMinorUnits(invoice.amountPaid.toString())
    if (refundedSoFarMinor + amountMinor > amountPaidMinor) {
      return res.status(400).json({ error: 'Refund amount exceeds what has been paid on this invoice' })
    }

    const refund = await prisma.$transaction(async (tx) => {
      const created = await tx.invoiceRefund.create({
        data: {
          organizationId,
          invoiceId,
          amount,
          refundDate: new Date(refundDate),
          reason: reason || null,
          depositAccountId,
        },
      })
      await postInvoiceRefundToLedger(tx, created, invoice.invoiceNumber, user.id)
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid: fromMinorUnits(amountPaidMinor - amountMinor) },
      })
      return tx.invoiceRefund.findUnique({ where: { id: created.id }, include: { invoice: { include: { customer: true } } } })
    })

    return res.status(201).json(refund)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
