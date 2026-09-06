import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { lines: true, vendor: true } })
  if (!po) return res.status(404).json({ error: 'Purchase order not found' })
  if (!(await userHasMembership(user.id, po.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') return res.status(200).json(po)

  if (req.method === 'PATCH') {
    const { status } = req.body || {}
    if (!['draft', 'sent', 'received', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }
    const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status } })
    return res.status(200).json(updated)
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).end()
}
