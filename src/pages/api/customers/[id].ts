import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const customer = await prisma.customer.findUnique({ where: { id } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (!(await userHasMembership(user.id, customer.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const invoices = await prisma.invoice.findMany({
    where: { customerId: id },
    orderBy: { createdAt: 'desc' },
  })

  return res.status(200).json({ customer, invoices })
}
