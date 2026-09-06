import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { applyVendorCreditToBill } from '../../../../lib/vendor-credits'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const { billId, amount } = req.body || {}
  if (!billId || !amount) return res.status(400).json({ error: 'billId and amount are required' })

  const credit = await prisma.vendorCredit.findUnique({ where: { id } })
  if (!credit) return res.status(404).json({ error: 'Vendor credit not found' })
  if (!(await userHasMembership(user.id, credit.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const bill = await prisma.bill.findUnique({ where: { id: billId } })
  if (!bill || bill.organizationId !== credit.organizationId || bill.vendorId !== credit.vendorId) {
    return res.status(400).json({ error: 'Bill does not belong to this vendor/organization' })
  }

  try {
    const updated = await prisma.$transaction((tx) => applyVendorCreditToBill(tx, credit, bill, amount, user.id))
    return res.status(200).json(updated)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
