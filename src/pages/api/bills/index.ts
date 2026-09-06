import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { computeBillTotals, nextBillNumber } from '../../../lib/purchasing'
import { toMinorUnits, multiplyMinor, fromMinorUnits } from '../../../lib/money'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const bills = await prisma.bill.findMany({
      where: { organizationId },
      include: { vendor: true },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(bills)
  }

  if (req.method === 'POST') {
    const { organizationId, vendorId, vendorReference, issueDate, dueDate, currency, lines, taxTotal, taxRateId } = req.body || {}
    if (!organizationId || !vendorId || !issueDate || !dueDate) {
      return res.status(400).json({ error: 'organizationId, vendorId, issueDate and dueDate are required' })
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'At least one bill line is required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
    if (!vendor || vendor.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Vendor does not belong to this organization' })
    }

    for (const l of lines) {
      if (!l.accountId || !l.description || l.quantity == null || l.unitPrice == null) {
        return res.status(400).json({ error: 'Each line requires accountId, description, quantity and unitPrice' })
      }
      const account = await prisma.account.findUnique({ where: { id: l.accountId } })
      if (!account || account.organizationId !== organizationId) {
        return res.status(400).json({ error: 'Bill line account does not belong to this organization' })
      }
      if (account.type !== 'expense' && account.type !== 'asset') {
        return res.status(400).json({ error: 'Bill lines must post to an expense or asset account' })
      }
      if (l.productId) {
        const product = await prisma.product.findUnique({ where: { id: l.productId } })
        if (!product || product.organizationId !== organizationId) {
          return res.status(400).json({ error: 'Bill line product does not belong to this organization' })
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

    const totals = computeBillTotals(lines, taxTotalFinal)

    const bill = await prisma.$transaction(async (tx) => {
      const billNumber = await nextBillNumber(tx, organizationId)
      return tx.bill.create({
        data: {
          organizationId,
          vendorId,
          billNumber,
          vendorReference: vendorReference || null,
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
        include: { lines: true, vendor: true },
      })
    })

    return res.status(201).json(bill)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
