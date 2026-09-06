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
    const pledges = await prisma.pledge.findMany({ where: { organizationId }, include: { fund: true }, orderBy: { pledgeDate: 'desc' } })
    return res.status(200).json(pledges)
  }

  if (req.method === 'POST') {
    const { organizationId, donorName, donorEmail, amount, pledgeDate, dueDate, fundId } = req.body || {}
    if (!organizationId || !donorName || !amount || !pledgeDate) {
      return res.status(400).json({ error: 'organizationId, donorName, amount and pledgeDate are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (fundId) {
      const fund = await prisma.fund.findUnique({ where: { id: fundId } })
      if (!fund || fund.organizationId !== organizationId) {
        return res.status(400).json({ error: 'Fund does not belong to this organization' })
      }
    }

    const pledge = await prisma.pledge.create({
      data: {
        organizationId,
        donorName,
        donorEmail: donorEmail || null,
        amount,
        pledgeDate: new Date(pledgeDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        fundId: fundId || null,
      },
    })
    return res.status(201).json(pledge)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
