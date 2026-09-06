import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { convertEstimateToInvoice } from '../../../../lib/estimates'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const estimate = await prisma.estimate.findUnique({ where: { id }, include: { lines: true } })
  if (!estimate) return res.status(404).json({ error: 'Estimate not found' })
  if (!(await userHasMembership(user.id, estimate.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (estimate.status === 'declined') return res.status(400).json({ error: 'A declined estimate cannot be converted' })

  const invoice = await prisma.$transaction((tx) => convertEstimateToInvoice(tx, estimate, user.id))
  return res.status(200).json(invoice)
}
