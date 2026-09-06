import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { computePoTotals, nextPoNumber } from '../../../lib/purchase-orders'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const pos = await prisma.purchaseOrder.findMany({
      where: { organizationId },
      include: { vendor: true },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(pos)
  }

  if (req.method === 'POST') {
    const { organizationId, vendorId, issueDate, expectedDate, currency, lines } = req.body || {}
    if (!organizationId || !vendorId || !issueDate) {
      return res.status(400).json({ error: 'organizationId, vendorId and issueDate are required' })
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'At least one line is required' })
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
        return res.status(400).json({ error: 'Line account does not belong to this organization' })
      }
    }

    const totals = computePoTotals(lines)
    const po = await prisma.$transaction(async (tx) => {
      const poNumber = await nextPoNumber(tx, organizationId)
      return tx.purchaseOrder.create({
        data: {
          organizationId,
          vendorId,
          poNumber,
          status: 'draft',
          issueDate: new Date(issueDate),
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          currency: currency || 'USD',
          subtotal: totals.subtotal,
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

    return res.status(201).json(po)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
