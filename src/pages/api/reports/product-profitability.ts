import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Product profitability report: revenue vs. COGS per product, derived
 * from posted invoice lines (revenue) and stock movements recorded at
 * cost (cost of goods sold), per src/lib/inventory.ts's average-cost
 * tracking.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined
  const issueDateFilter: any = {}
  if (startDate) issueDateFilter.gte = startDate
  if (endDate) issueDateFilter.lte = endDate
  const createdAtFilter: any = {}
  if (startDate) createdAtFilter.gte = startDate
  if (endDate) createdAtFilter.lte = endDate

  const products = await prisma.product.findMany({ where: { organizationId } })
  const invoiceLines = await prisma.invoiceLine.findMany({
    where: {
      invoice: { organizationId, voidedAt: null, ...(Object.keys(issueDateFilter).length ? { issueDate: issueDateFilter } : {}) },
      NOT: { productId: null },
    },
  })
  const saleMovements = await prisma.stockMovement.findMany({
    where: { organizationId, type: 'sale', ...(Object.keys(createdAtFilter).length ? { createdAt: createdAtFilter } : {}) },
  })

  const rows = products.map((p) => {
    const lines = invoiceLines.filter((l) => l.productId === p.id)
    const revenue = lines.reduce((s, l) => s + Number(l.amount), 0)
    const unitsSold = lines.reduce((s, l) => s + Number(l.quantity), 0)
    const cogs = saleMovements
      .filter((m) => m.productId === p.id)
      .reduce((s, m) => s + Math.abs(Number(m.quantity)) * Number(m.unitCost || 0), 0)
    return { productId: p.id, name: p.name, unitsSold, revenue, cogs, grossProfit: revenue - cogs, marginPercent: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : null }
  })

  return res.status(200).json({ products: rows, method: 'Revenue = sum of invoice line amounts for the product; COGS = sum of |quantity| * unitCost across sale-type stock movements for the product.' })
}
