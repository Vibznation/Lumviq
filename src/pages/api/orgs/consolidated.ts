import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Consolidated multi-entity view: shows each organization's key figures
 * side-by-side plus a simple sum. This intentionally does NOT merge
 * journal entries or ledgers across entities — each org remains a fully
 * independent legal/accounting entity.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const root = await prisma.organization.findUnique({ where: { id: organizationId } })
  if (!root) return res.status(404).json({ error: 'Organization not found' })

  const children = await prisma.organization.findMany({ where: { parentOrganizationId: organizationId } })
  const orgs = [root, ...children]

  const results = await Promise.all(
    orgs.map(async (org) => {
      const accounts = await prisma.account.findMany({ where: { organizationId: org.id } })
      const accountsById = new Map(accounts.map((a) => [a.id, a]))
      const lines = await prisma.journalLine.findMany({
        where: { journalEntry: { organizationId: org.id, posted: true }, accountId: { in: accounts.map((a) => a.id) } },
      })
      const totals = { asset: 0, liability: 0, equity: 0, income: 0, expense: 0 }
      for (const line of lines) {
        const account = accountsById.get(line.accountId)
        if (!account) continue
        const amount = Number(line.amount)
        const signed = line.isDebit ? amount : -amount
        totals[account.type as keyof typeof totals] = (totals[account.type as keyof typeof totals] || 0) + signed
      }
      const revenue = -totals.income
      const expenses = totals.expense
      return {
        organizationId: org.id,
        name: org.name,
        isParent: org.id === organizationId,
        assets: totals.asset,
        liabilities: -totals.liability,
        equity: -totals.equity,
        revenue,
        expenses,
        netIncome: revenue - expenses,
      }
    })
  )

  const combined = results.reduce(
    (acc, r) => ({
      assets: acc.assets + r.assets,
      liabilities: acc.liabilities + r.liabilities,
      equity: acc.equity + r.equity,
      revenue: acc.revenue + r.revenue,
      expenses: acc.expenses + r.expenses,
      netIncome: acc.netIncome + r.netIncome,
    }),
    { assets: 0, liabilities: 0, equity: 0, revenue: 0, expenses: 0, netIncome: 0 }
  )

  return res.status(200).json({ entities: results, combined })
}
