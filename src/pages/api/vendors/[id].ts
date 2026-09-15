import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const vendor = await prisma.vendor.findUnique({ where: { id } })
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' })
  if (!(await userHasMembership(user.id, vendor.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const [bills, vendorCredits, purchaseOrders] = await Promise.all([
    prisma.bill.findMany({ where: { vendorId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.vendorCredit.findMany({ where: { vendorId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.purchaseOrder.findMany({ where: { vendorId: id }, orderBy: { createdAt: 'desc' } }),
  ])

  return res.status(200).json({ vendor, bills, vendorCredits, purchaseOrders })
}
