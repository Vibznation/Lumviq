/**
 * Minimal on-demand workflow automation engine. There is no background
 * scheduler in this app (see docs/known-limitations.md) — rules only run
 * when POST /api/workflows/run-due is called (e.g. a button on the
 * Workflows settings page, or a future external cron hitting that route).
 *
 * Supported trigger types:
 *   invoice_overdue: fires once per overdue invoice per run when
 *     triggerConfig.daysOverdue or more days have passed the due date.
 *   bill_due_soon: fires once per bill due within triggerConfig.daysAhead.
 *   low_stock: fires once per product at/under its reorder point.
 *
 * Supported action types: 'notify' (creates a Notification) and
 * 'create_approval' (creates a pending Approval for a human to review).
 */
import { createNotification } from './notifications'

async function findMatches(tx: any, organizationId: string, rule: any) {
  const cfg = rule.triggerConfig || {}
  if (rule.triggerType === 'invoice_overdue') {
    const daysOverdue = cfg.daysOverdue ?? 1
    const cutoff = new Date(Date.now() - daysOverdue * 86400000)
    const invoices = await tx.invoice.findMany({
      where: { organizationId, status: { in: ['sent', 'partially_paid'] }, dueDate: { lt: cutoff } },
      include: { customer: true },
    })
    return invoices.map((inv: any) => ({
      id: inv.id,
      message: `Invoice ${inv.invoiceNumber} for ${inv.customer.name} is overdue`,
      link: `/sales/invoices/${inv.id}`,
    }))
  }
  if (rule.triggerType === 'bill_due_soon') {
    const daysAhead = cfg.daysAhead ?? 3
    const cutoff = new Date(Date.now() + daysAhead * 86400000)
    const bills = await tx.bill.findMany({
      where: { organizationId, status: { in: ['open', 'partially_paid'] }, dueDate: { lte: cutoff } },
      include: { vendor: true },
    })
    return bills.map((b: any) => ({
      id: b.id,
      message: `Bill ${b.billNumber} from ${b.vendor.name} is due soon`,
      link: `/purchasing/bills/${b.id}`,
    }))
  }
  if (rule.triggerType === 'low_stock') {
    const products = await tx.product.findMany({ where: { organizationId, active: true, reorderPoint: { not: null } } })
    return products
      .filter((p: any) => p.reorderPoint != null && Number(p.quantityOnHand) <= Number(p.reorderPoint))
      .map((p: any) => ({ id: p.id, message: `${p.name} is at or below its reorder point`, link: '/inventory' }))
  }
  return []
}

/** Evaluates every active rule for an organization and executes matches. Returns a run summary. */
export async function runDueWorkflowRules(tx: any, organizationId: string) {
  const rules = await tx.workflowRule.findMany({ where: { organizationId, active: true } })
  const summary: Array<{ ruleId: string; ruleName: string; matches: number }> = []
  let systemActorId: string | null = null

  for (const rule of rules) {
    const matches = await findMatches(tx, organizationId, rule)
    for (const match of matches) {
      if (rule.actionType === 'create_approval') {
        if (!systemActorId) {
          const owner = await tx.organizationMembership.findFirst({ where: { organizationId, role: 'owner' } })
          systemActorId = owner?.userId ?? null
        }
        if (!systemActorId) continue // no owner to attribute the approval to; skip rather than write an invalid record
        await tx.approval.create({
          data: {
            organizationId,
            resourceType: `workflow:${rule.triggerType}`,
            resourceId: match.id,
            status: 'pending',
            note: match.message,
            requestedByUserId: systemActorId,
          },
        })
      } else {
        await createNotification(tx, {
          organizationId,
          type: `workflow.${rule.triggerType}`,
          title: rule.name,
          message: match.message,
          link: match.link,
        })
      }
    }
    await tx.workflowRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } })
    summary.push({ ruleId: rule.id, ruleName: rule.name, matches: matches.length })
  }

  return summary
}
