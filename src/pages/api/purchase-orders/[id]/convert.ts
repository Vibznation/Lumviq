import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { convertPurchaseOrderToBill } from '../../../../lib/purchase-orders'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { lines: true } })
  if (!po) return res.status(404).json({ error: 'Purchase order not found' })
  if (!(await userHasMembership(user.id, po.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const bill = await prisma.$transaction(async (tx) => {
    const count = await tx.bill.count({ where: { organizationId: po.organizationId } })
    const billNumber = `BILL-${String(count + 1).padStart(4, '0')}`
    return convertPurchaseOrderToBill(tx, po, billNumber, user.id)
  })
  return res.status(200).json(bill)
}
