import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * "AI chat" — NOT a real LLM integration. This is a small deterministic
 * keyword router over the organization's own data, consistent with
 * insights.ts: every answer states exactly which query produced it. See
 * docs/known-limitations.md for why this is intentionally not a live
 * model call (no external AI provider credentials/data-sharing agreement
 * exists for this app).
 */
async function answer(organizationId: string, question: string): Promise<{ answer: string; basis: any }> {
  const q = question.toLowerCase()

  if (q.includes('cash') || q.includes('balance')) {
    const accounts = await prisma.account.findMany({ where: { organizationId, subtype: 'bank' } })
    const lines = await prisma.journalLine.findMany({
      where: { accountId: { in: accounts.map((a) => a.id) }, journalEntry: { organizationId, posted: true } },
    })
    const cash = lines.reduce((s, l) => s + (l.isDebit ? Number(l.amount) : -Number(l.amount)), 0)
    return { answer: `Current cash on hand across bank accounts is ${cash.toFixed(2)}.`, basis: { method: 'Sum of posted journal lines against bank-subtype accounts.' } }
  }

  if (q.includes('overdue') || q.includes('past due')) {
    const overdue = await prisma.invoice.findMany({ where: { organizationId, status: { in: ['sent', 'partially_paid'] }, dueDate: { lt: new Date() } } })
    const total = overdue.reduce((s, inv) => s + (Number(inv.total) - Number(inv.amountPaid)), 0)
    return { answer: `${overdue.length} invoice(s) are overdue, totaling ${total.toFixed(2)}.`, basis: { count: overdue.length, total } }
  }

  if (q.includes('bill') && (q.includes('due') || q.includes('pay'))) {
    const bills = await prisma.bill.findMany({ where: { organizationId, status: { in: ['open', 'partially_paid'] } }, orderBy: { dueDate: 'asc' }, take: 5, include: { vendor: true } })
    const list = bills.map((b) => `${b.billNumber} (${b.vendor.name}, due ${b.dueDate.toISOString().slice(0, 10)})`).join('; ')
    return { answer: bills.length > 0 ? `Upcoming bills to pay: ${list}.` : 'There are no open bills.', basis: { bills: bills.map((b) => b.billNumber) } }
  }

  if (q.includes('profit') || q.includes('net income')) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
    const lines = await prisma.journalLine.findMany({
      where: { journalEntry: { organizationId, posted: true, postedAt: { gte: ninetyDaysAgo } }, account: { type: { in: ['income', 'expense'] } } },
      include: { account: true },
    })
    let revenue = 0, expense = 0
    for (const l of lines) {
      const amt = Number(l.amount)
      if (l.account.type === 'income') revenue += l.isDebit ? -amt : amt
      else expense += l.isDebit ? amt : -amt
    }
    return { answer: `Over the last 90 days, revenue was ${revenue.toFixed(2)} and expenses were ${expense.toFixed(2)}, for net income of ${(revenue - expense).toFixed(2)}.`, basis: { revenue, expense } }
  }

  return {
    answer: "I can answer questions about cash on hand, overdue invoices, upcoming bills, and recent profit. Try asking something like \"What's my cash balance?\" or \"What invoices are overdue?\"",
    basis: { method: 'No keyword matched; this is a fixed set of supported questions, not a general-purpose assistant.' },
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { organizationId, question } = req.body || {}
  if (!organizationId || !question) return res.status(400).json({ error: 'organizationId and question are required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const result = await answer(organizationId, String(question))

  await prisma.aiInteraction.create({
    data: {
      organizationId,
      userId: user.id,
      kind: 'intelligence.chat',
      basis: JSON.stringify(result.basis),
      inputSummary: { question },
      outputSummary: { answer: result.answer },
    },
  })

  return res.status(200).json(result)
}
