import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { computeEstimateTotals, nextEstimateNumber } from '../../../lib/estimates'
import { toMinorUnits, multiplyMinor, fromMinorUnits } from '../../../lib/money'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const estimates = await prisma.estimate.findMany({
      where: { organizationId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(estimates)
  }

  if (req.method === 'POST') {
    const { organizationId, customerId, issueDate, expiryDate, currency, lines, taxTotal, taxRateId } = req.body || {}
    if (!organizationId || !customerId || !issueDate) {
      return res.status(400).json({ error: 'organizationId, customerId and issueDate are required' })
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'At least one estimate line is required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

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
        return res.status(400).json({ error: 'Estimate line account does not belong to this organization' })
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

    const totals = computeEstimateTotals(lines, taxTotalFinal)

    const estimate = await prisma.$transaction(async (tx) => {
      const estimateNumber = await nextEstimateNumber(tx, organizationId)
      return tx.estimate.create({
        data: {
          organizationId,
          customerId,
          estimateNumber,
          status: 'draft',
          issueDate: new Date(issueDate),
          expiryDate: expiryDate ? new Date(expiryDate) : null,
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

    return res.status(201).json(estimate)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
