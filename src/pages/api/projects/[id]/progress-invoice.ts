import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { computeInvoiceTotals, nextInvoiceNumber } from '../../../../lib/invoicing'

/**
 * Progress invoicing: bills a project's customer for its uninvoiced
 * billable time entries. Requires an account to post the line items
 * against (typically a services/revenue account). Marks the included
 * time entries as invoiced so they cannot be billed twice.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const { accountId } = req.body || {}
  if (!accountId) return res.status(400).json({ error: 'accountId is required' })

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return res.status(404).json({ error: 'Project not found' })
  if (!(await userHasMembership(user.id, project.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!project.customerId) return res.status(400).json({ error: 'This project has no customer to invoice' })

  const account = await prisma.account.findUnique({ where: { id: accountId } })
  if (!account || account.organizationId !== project.organizationId) {
    return res.status(400).json({ error: 'Account does not belong to this organization' })
  }

  const uninvoiced = await prisma.timeEntry.findMany({
    where: { projectId: id, billable: true, invoiced: false, rate: { not: null } },
    orderBy: { date: 'asc' },
  })
  if (uninvoiced.length === 0) return res.status(400).json({ error: 'No uninvoiced billable time entries for this project' })

  const lines = uninvoiced.map((t) => ({ quantity: t.hours.toString(), unitPrice: t.rate!.toString(), description: t.description || `Time entry ${t.date.toISOString().slice(0, 10)}`, accountId }))
  const totals = computeInvoiceTotals(lines)

  const invoice = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(tx, project.organizationId)
    const created = await tx.invoice.create({
      data: {
        organizationId: project.organizationId,
        customerId: project.customerId!,
        invoiceNumber,
        status: 'draft',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        currency: 'USD',
        subtotal: totals.subtotal,
        taxTotal: '0',
        total: totals.total,
        lines: { create: lines.map((l, i) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount: totals.lineAmounts[i], accountId: l.accountId })) },
      },
    })
    await tx.timeEntry.updateMany({ where: { id: { in: uninvoiced.map((t) => t.id) } }, data: { invoiced: true } })
    return created
  })

  return res.status(201).json(invoice)
}
