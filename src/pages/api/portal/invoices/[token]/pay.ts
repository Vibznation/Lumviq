import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../../server/prisma'
import { resolveInvoicePortalToken } from '../../../../../lib/portal-tokens'
import { getPaymentProcessor } from '../../../../../lib/integrations/payments'
import { postInvoicePaymentToLedger } from '../../../../../lib/invoicing'
import { toMinorUnits, fromMinorUnits } from '../../../../../lib/money'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const token = req.query.token as string
  const invoice = await resolveInvoicePortalToken(prisma, token)
  if (!invoice) return res.status(404).json({ error: 'This link is invalid or has expired' })

  if (invoice.status === 'paid') {
    return res.status(400).json({ error: 'Invoice is already fully paid' })
  }
  if (invoice.voidedAt) {
    return res.status(400).json({ error: 'Invoice has been voided' })
  }

  const processor = getPaymentProcessor()
  if (!processor || !processor.isConfigured()) {
    return res.status(503).json({ error: 'Online payment is not configured for this merchant' })
  }

  const totalMinor = toMinorUnits(invoice.total.toString())
  const paidMinor = toMinorUnits(invoice.amountPaid.toString())
  const remainingMinor = totalMinor - paidMinor

  if (remainingMinor <= BigInt(0)) {
    return res.status(400).json({ error: 'No remaining balance on this invoice' })
  }

  const remainingFormatted = fromMinorUnits(remainingMinor)

  try {
    const paymentIntent = await processor.createPaymentIntent(
      invoice.organizationId,
      remainingFormatted,
      invoice.currency || 'USD',
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      }
    )

    // Find default cash/bank deposit account for the organization
    const depositAccount = await prisma.account.findFirst({
      where: {
        organizationId: invoice.organizationId,
        type: 'asset',
      },
      orderBy: { code: 'asc' },
    })

    if (!depositAccount) {
      return res.status(500).json({ error: 'No asset account found to deposit payment' })
    }

    // If payment succeeded immediately (sandbox or direct confirmation)
    if (paymentIntent.status === 'succeeded') {
      await prisma.$transaction(async (tx) => {
        const payment = await tx.invoicePayment.create({
          data: {
            invoiceId: invoice.id,
            organizationId: invoice.organizationId,
            amount: remainingFormatted,
            paymentDate: new Date(),
            method: `Online (${processor.name})`,
            depositAccountId: depositAccount.id,
          },
        })

        // Use system actor or first org member
        const systemMember = await tx.organizationMembership.findFirst({
          where: { organizationId: invoice.organizationId },
        })
        const actorId = systemMember ? systemMember.userId : 'system'

        const entry = await postInvoicePaymentToLedger(tx, payment, invoice.invoiceNumber, actorId)
        await tx.invoicePayment.update({ where: { id: payment.id }, data: { journalEntryId: entry.id } })

        const newAmountPaidMinor = paidMinor + remainingMinor
        const newStatus = newAmountPaidMinor >= totalMinor ? 'paid' : 'partially_paid'

        await tx.invoice.update({
          where: { id: invoice.id },
          data: { amountPaid: fromMinorUnits(newAmountPaidMinor), status: newStatus },
        })
      })

      return res.status(200).json({
        success: true,
        status: 'succeeded',
        message: 'Payment received and processed successfully',
        paymentIntent,
      })
    }

    return res.status(200).json({
      success: true,
      status: paymentIntent.status,
      clientSecret: paymentIntent.clientSecret,
      paymentIntent,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Payment processing failed' })
  }
}
