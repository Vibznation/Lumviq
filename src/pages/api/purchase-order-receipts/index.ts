import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { recordReceipt } from '../../../lib/three-way-match'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const purchaseOrderId = req.query.purchaseOrderId as string | undefined
    if (!purchaseOrderId) return res.status(400).json({ error: 'purchaseOrderId is required' })
    const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } })
    if (!po) return res.status(404).json({ error: 'Purchase order not found' })
    if (!(await userHasMembership(user.id, po.organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const receipts = await prisma.purchaseOrderReceipt.findMany({ where: { purchaseOrderId }, include: { lines: true }, orderBy: { receivedDate: 'desc' } })
    return res.status(200).json(receipts)
  }

  if (req.method === 'POST') {
    const { organizationId, purchaseOrderId, receivedDate, notes, lines } = req.body || {}
    if (!organizationId || !purchaseOrderId || !receivedDate || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'organizationId, purchaseOrderId, receivedDate and lines are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const receipt = await prisma.$transaction((tx) =>
      recordReceipt(tx, { organizationId, purchaseOrderId, receivedDate: new Date(receivedDate), notes, lines })
    )
    return res.status(201).json(receipt)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
