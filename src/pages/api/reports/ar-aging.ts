import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

function bucketFor(daysOverdue: number) {
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return 'days1to30'
  if (daysOverdue <= 60) return 'days31to60'
  if (daysOverdue <= 90) return 'days61to90'
  return 'days90plus'
}

/** Accounts-receivable aging: outstanding invoice balances bucketed by days past due. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const invoices = await prisma.invoice.findMany({
    where: { organizationId, voidedAt: null, status: { in: ['sent', 'partially_paid', 'overdue'] } },
    include: { customer: true },
  })

  const now = Date.now()
  const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 }
  const rows = invoices.map((inv) => {
    const balance = Number(inv.total) - Number(inv.amountPaid)
    const daysOverdue = Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000)
    const bucket = bucketFor(daysOverdue)
    buckets[bucket as keyof typeof buckets] += balance
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customer.name,
      dueDate: inv.dueDate,
      balance,
      daysOverdue,
      bucket,
    }
  })

  return res.status(200).json({ rows, buckets, total: rows.reduce((s, r) => s + r.balance, 0) })
}
