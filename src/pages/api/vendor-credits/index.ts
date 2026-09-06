import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { postVendorCreditToLedger } from '../../../lib/vendor-credits'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const credits = await prisma.vendorCredit.findMany({
      where: { organizationId },
      include: { vendor: true },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json(credits)
  }

  if (req.method === 'POST') {
    const { organizationId, vendorId, amount, reason, expenseAccountId } = req.body || {}
    if (!organizationId || !vendorId || !amount || !expenseAccountId) {
      return res.status(400).json({ error: 'organizationId, vendorId, amount and expenseAccountId are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } })
    if (!vendor || vendor.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Vendor does not belong to this organization' })
    }
    const account = await prisma.account.findUnique({ where: { id: expenseAccountId } })
    if (!account || account.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Expense account does not belong to this organization' })
    }

    const credit = await prisma.$transaction(async (tx) => {
      const count = await tx.vendorCredit.count({ where: { organizationId } })
      const creditNumber = `VC-${String(count + 1).padStart(4, '0')}`
      const created = await tx.vendorCredit.create({
        data: { organizationId, vendorId, creditNumber, amount, remainingAmount: amount, reason: reason || null, expenseAccountId },
      })
      await postVendorCreditToLedger(tx, created, user.id)
      return tx.vendorCredit.findUnique({ where: { id: created.id }, include: { vendor: true } })
    })

    return res.status(201).json(credit)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
