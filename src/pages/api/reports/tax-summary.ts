import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Tax readiness summary: tax collected on sent/paid invoices minus tax paid
 * on posted bills, grouped by tax rate. This is an informational report, not
 * a filing — Lumviq does not file taxes on the organization's behalf.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const [invoices, bills, rates] = await Promise.all([
    prisma.invoice.findMany({
      where: { organizationId, voidedAt: null, status: { not: 'draft' } },
      select: { taxRateId: true, taxTotal: true },
    }),
    prisma.bill.findMany({
      where: { organizationId, voidedAt: null, status: { not: 'draft' } },
      select: { taxRateId: true, taxTotal: true },
    }),
    prisma.taxRate.findMany({ where: { organizationId } }),
  ])

  const byRate: Record<string, { name: string; collected: number; paid: number }> = {}
  for (const r of rates) byRate[r.id] = { name: r.name, collected: 0, paid: 0 }
  byRate['none'] = { name: 'No tax rate applied', collected: 0, paid: 0 }

  for (const inv of invoices) {
    const key = inv.taxRateId || 'none'
    if (!byRate[key]) byRate[key] = { name: 'Unknown rate', collected: 0, paid: 0 }
    byRate[key].collected += Number(inv.taxTotal)
  }
  for (const bill of bills) {
    const key = bill.taxRateId || 'none'
    if (!byRate[key]) byRate[key] = { name: 'Unknown rate', collected: 0, paid: 0 }
    byRate[key].paid += Number(bill.taxTotal)
  }

  const summary = Object.entries(byRate)
    .map(([id, v]) => ({ taxRateId: id, name: v.name, collected: v.collected, paid: v.paid, netOwed: v.collected - v.paid }))
    .filter((r) => r.collected !== 0 || r.paid !== 0)

  return res.status(200).json({ summary, totalNetOwed: summary.reduce((s, r) => s + r.netOwed, 0) })
}
