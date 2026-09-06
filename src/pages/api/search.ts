import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../lib/authorization'

export interface SearchResult {
  type: 'customer' | 'vendor' | 'invoice' | 'bill' | 'account'
  id: string
  label: string
  sublabel?: string
  href: string
}

/**
 * Backend for the global command bar (see src/components/AppShell.tsx).
 * Searches customers, vendors, invoices, bills and chart-of-accounts by
 * name/number/code. Does not yet support "ask a question" or "create
 * something" natural-language actions from prompt.md's GLOBAL COMMAND BAR
 * spec — only structured record search is implemented; see
 * docs/known-limitations.md.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  const q = (req.query.q as string | undefined)?.trim()
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!q || q.length < 2) return res.status(200).json({ results: [] })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const contains = { contains: q, mode: 'insensitive' as const }

  const [customers, vendors, invoices, bills, accounts] = await Promise.all([
    prisma.customer.findMany({ where: { organizationId, name: contains }, take: 5 }),
    prisma.vendor.findMany({ where: { organizationId, name: contains }, take: 5 }),
    prisma.invoice.findMany({ where: { organizationId, invoiceNumber: contains }, include: { customer: true }, take: 5 }),
    prisma.bill.findMany({ where: { organizationId, billNumber: contains }, include: { vendor: true }, take: 5 }),
    prisma.account.findMany({ where: { organizationId, OR: [{ name: contains }, { code: contains }] }, take: 5 }),
  ])

  const results: SearchResult[] = [
    ...customers.map((c) => ({ type: 'customer' as const, id: c.id, label: c.name, sublabel: 'Customer', href: '/sales/customers' })),
    ...vendors.map((v) => ({ type: 'vendor' as const, id: v.id, label: v.name, sublabel: 'Vendor', href: '/purchasing/vendors' })),
    ...invoices.map((i) => ({
      type: 'invoice' as const,
      id: i.id,
      label: i.invoiceNumber,
      sublabel: `Invoice · ${i.customer.name}`,
      href: `/sales/invoices/${i.id}`,
    })),
    ...bills.map((b) => ({
      type: 'bill' as const,
      id: b.id,
      label: b.billNumber,
      sublabel: `Bill · ${b.vendor.name}`,
      href: `/purchasing/bills/${b.id}`,
    })),
    ...accounts.map((a) => ({ type: 'account' as const, id: a.id, label: `${a.code} ${a.name}`, sublabel: 'Account', href: '/accounting/chart-of-accounts' })),
  ]

  return res.status(200).json({ results })
}
