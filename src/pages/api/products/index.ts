import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const products = await prisma.product.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
    return res.status(200).json(products)
  }

  if (req.method === 'POST') {
    const { organizationId, sku, name, type, salesPrice, costPrice, incomeAccountId, expenseAccountId, inventoryAssetAccountId, reorderPoint } = req.body || {}
    if (!organizationId || !name || !incomeAccountId || !expenseAccountId) {
      return res.status(400).json({ error: 'organizationId, name, incomeAccountId and expenseAccountId are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const income = await prisma.account.findUnique({ where: { id: incomeAccountId } })
    if (!income || income.organizationId !== organizationId || income.type !== 'income') {
      return res.status(400).json({ error: 'incomeAccountId must be a valid income account in this organization' })
    }
    const expense = await prisma.account.findUnique({ where: { id: expenseAccountId } })
    if (!expense || expense.organizationId !== organizationId || expense.type !== 'expense') {
      return res.status(400).json({ error: 'expenseAccountId must be a valid expense account in this organization' })
    }
    if (type === 'inventory') {
      if (!inventoryAssetAccountId) return res.status(400).json({ error: 'inventoryAssetAccountId is required for inventory-tracked products' })
      const asset = await prisma.account.findUnique({ where: { id: inventoryAssetAccountId } })
      if (!asset || asset.organizationId !== organizationId || asset.type !== 'asset') {
        return res.status(400).json({ error: 'inventoryAssetAccountId must be a valid asset account in this organization' })
      }
    }

    const product = await prisma.product.create({
      data: {
        organizationId,
        sku: sku || null,
        name,
        type: type || 'service',
        salesPrice: salesPrice || null,
        costPrice: costPrice || null,
        incomeAccountId,
        expenseAccountId,
        inventoryAssetAccountId: type === 'inventory' ? inventoryAssetAccountId : null,
        reorderPoint: reorderPoint || null,
      },
    })
    return res.status(201).json(product)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
