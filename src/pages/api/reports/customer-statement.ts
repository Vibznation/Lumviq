import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/** Customer statement: all open/overdue invoices and recent payments for one customer, for a printable statement view. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const customerId = req.query.customerId as string | undefined
  if (!customerId) return res.status(400).json({ error: 'customerId is required' })

  const customer = await prisma.customer.findUnique({ where: { id: customerId } })
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  if (!(await userHasMembership(user.id, customer.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const invoices = await prisma.invoice.findMany({
    where: { customerId, voidedAt: null, status: { in: ['sent', 'partially_paid', 'paid'] } },
    include: { payments: true },
    orderBy: { issueDate: 'desc' },
  })

  const rows = invoices.map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    total: Number(inv.total),
    amountPaid: Number(inv.amountPaid),
    balance: Number(inv.total) - Number(inv.amountPaid),
    status: inv.status,
    overdue: inv.dueDate < new Date() && inv.status !== 'paid',
  }))
  const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0)

  return res.status(200).json({ customer: { id: customer.id, name: customer.name }, invoices: rows, totalOutstanding })
}
