import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { checkThreeWayMatch } from '../../../lib/three-way-match'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const purchaseOrderId = req.query.purchaseOrderId as string | undefined
  const billId = req.query.billId as string | undefined
  if (!purchaseOrderId) return res.status(400).json({ error: 'purchaseOrderId is required' })
  const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } })
  if (!po) return res.status(404).json({ error: 'Purchase order not found' })
  if (!(await userHasMembership(user.id, po.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const result = await checkThreeWayMatch(prisma, purchaseOrderId, billId)
  return res.status(200).json(result)
}
