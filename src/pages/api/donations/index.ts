import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { postDonationToLedger } from '../../../lib/nonprofit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const donations = await prisma.donation.findMany({ where: { organizationId }, include: { fund: true }, orderBy: { date: 'desc' } })
    return res.status(200).json(donations)
  }

  if (req.method === 'POST') {
    const { organizationId, donorName, donorEmail, amount, date, fundId, method, depositAccountId } = req.body || {}
    if (!organizationId || !donorName || !amount || !date || !depositAccountId) {
      return res.status(400).json({ error: 'organizationId, donorName, amount, date and depositAccountId are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const account = await prisma.account.findUnique({ where: { id: depositAccountId } })
    if (!account || account.organizationId !== organizationId) {
      return res.status(400).json({ error: 'Deposit account does not belong to this organization' })
    }
    if (fundId) {
      const fund = await prisma.fund.findUnique({ where: { id: fundId } })
      if (!fund || fund.organizationId !== organizationId) {
        return res.status(400).json({ error: 'Fund does not belong to this organization' })
      }
    }

    const donation = await prisma.$transaction(async (tx) => {
      const created = await tx.donation.create({
        data: { organizationId, donorName, donorEmail: donorEmail || null, amount, date: new Date(date), fundId: fundId || null, method: method || null, depositAccountId },
      })
      await postDonationToLedger(tx, created, user.id)
      return tx.donation.findUnique({ where: { id: created.id }, include: { fund: true } })
    })
    return res.status(201).json(donation)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
