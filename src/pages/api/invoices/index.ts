import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { computeInvoiceTotals, nextInvoiceNumber } from '../../../lib/invoicing'
import { toMinorUnits, multiplyMinor, fromMinorUnits } from '../../../lib/money'
import { enforceLimit } from '../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const invoices = await prisma.invoice.findMany({
      where: { organizationId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(invoices)
  }

  if (req.method === 'POST') {
    const { organizationId, customerId, projectId, issueDate, dueDate, currency, lines, taxTotal, taxRateId } = req.body || {}
    if (!organizationId || !customerId || !issueDate || !dueDate) {
      return res.status(400).json({ error: 'organizationId, customerId, issueDate and dueDate are required' })
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'At least one invoice line is required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const invoicesThisMonth = await prisma.invoice.count({ where: { organizationId, createdAt: { gte: monthStart } } })
    if (!(await enforceLimit(res, prisma, organizationId, 'invoicesPerMonth', invoicesThisMonth))) return

    const customer = await prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer || customer.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Customer does not belong to this organization' })
    }

    for (const l of lines) {
      if (!l.accountId || !l.description || l.quantity == null || l.unitPrice == null) {
        return res.status(400).json({ error: 'Each line requires accountId, description, quantity and unitPrice' })
      }
      const account = await prisma.account.findUnique({ where: { id: l.accountId } })
      if (!account || account.organizationId !== organizationId) {
        return res.status(400).json({ error: 'Invoice line account does not belong to this organization' })
      }
      if (account.type !== 'income') {
        return res.status(400).json({ error: 'Invoice lines must post to an income account' })
      }
      if (l.productId) {
        const product = await prisma.product.findUnique({ where: { id: l.productId } })
        if (!product || product.organizationId !== organizationId) {
          return res.status(400).json({ error: 'Invoice line product does not belong to this organization' })
        }
      }
    }

    let taxTotalFinal = taxTotal || '0'
    if (taxRateId) {
      const rate = await prisma.taxRate.findUnique({ where: { id: taxRateId } })
      if (!rate || rate.organizationId !== organizationId) {
        return res.status(400).json({ error: 'Tax rate does not belong to this organization' })
      }
      const subtotalMinor = lines.reduce(
        (sum: bigint, l: any) => sum + (toMinorUnits(l.quantity) * toMinorUnits(l.unitPrice)) / BigInt(1_000_000),
        BigInt(0)
      )
      taxTotalFinal = fromMinorUnits(multiplyMinor(subtotalMinor, toMinorUnits(rate.rate.toString())))
    }

    const totals = computeInvoiceTotals(lines, taxTotalFinal)

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextInvoiceNumber(tx, organizationId)
      return tx.invoice.create({
        data: {
          organizationId,
          customerId,
          projectId: projectId || null,
          invoiceNumber,
          status: 'draft',
          issueDate: new Date(issueDate),
          dueDate: new Date(dueDate),
          currency: currency || 'USD',
          subtotal: totals.subtotal,
          taxRateId: taxRateId || null,
          taxTotal: totals.taxTotal,
          total: totals.total,
          lines: {
            create: lines.map((l: any, i: number) => ({
              description: l.description,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              amount: totals.lineAmounts[i],
              accountId: l.accountId,
              productId: l.productId || null,
            })),
          },
        },
        include: { lines: true, customer: true },
      })
    })

    return res.status(201).json(invoice)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
