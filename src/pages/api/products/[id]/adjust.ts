import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { recordAdjustmentStockMovement } from '../../../../lib/inventory'

/** Manual stock adjustment (stocktake correction, shrinkage, damage). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const { quantity, note } = req.body || {}
  if (quantity == null || !note) return res.status(400).json({ error: 'quantity and note are required' })

  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) return res.status(404).json({ error: 'Product not found' })
  if (!(await userHasMembership(user.id, product.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (product.type !== 'inventory') return res.status(400).json({ error: 'Only inventory-tracked products support stock adjustments' })

  try {
    await prisma.$transaction((tx) => recordAdjustmentStockMovement(tx, product.organizationId, product.id, quantity, note))
    const updated = await prisma.product.findUnique({ where: { id } })
    return res.status(200).json(updated)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
