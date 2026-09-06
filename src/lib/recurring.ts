/**
 * Recurring invoice/bill templates. There is no background job scheduler
 * in this app (see docs/known-limitations.md) — a template only advances
 * when a user (or a future cron) calls runRecurringTemplate / hits
 * POST /api/recurring/[id]/run. "Due" templates are ones whose
 * nextRunDate has passed; the /data settings page surfaces these so a
 * user can run them on demand.
 */

function advanceDate(date: Date, frequency: string): Date {
  const next = new Date(date)
  if (frequency === 'weekly') next.setDate(next.getDate() + 7)
  else if (frequency === 'quarterly') next.setMonth(next.getMonth() + 3)
  else if (frequency === 'annual') next.setFullYear(next.getFullYear() + 1)
  else next.setMonth(next.getMonth() + 1) // monthly default
  return next
}

type TemplateLine = { description: string; quantity: string | number; unitPrice: string | number; accountId: string; productId?: string | null }

/**
 * Generates one Invoice or Bill from a recurring template (as a draft —
 * it is not automatically sent/posted), then advances nextRunDate.
 */
export async function runRecurringTemplate(tx: any, template: any, actorId: string) {
  const { computeInvoiceTotals } = await import('./invoicing')
  const lines: TemplateLine[] = template.templateLines
  const totals = computeInvoiceTotals(lines)

  let created: any
  if (template.type === 'invoice') {
    const { nextInvoiceNumber } = await import('./invoicing')
    const invoiceNumber = await nextInvoiceNumber(tx, template.organizationId)
    created = await tx.invoice.create({
      data: {
        organizationId: template.organizationId,
        customerId: template.partyId,
        invoiceNumber,
        status: 'draft',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        currency: 'USD',
        subtotal: totals.subtotal,
        taxRateId: template.taxRateId,
        taxTotal: totals.taxTotal,
        total: totals.total,
        lines: {
          create: lines.map((l, i) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            amount: totals.lineAmounts[i],
            accountId: l.accountId,
            productId: l.productId || null,
          })),
        },
      },
    })
  } else {
    const count = await tx.bill.count({ where: { organizationId: template.organizationId } })
    const billNumber = `BILL-${String(count + 1).padStart(4, '0')}`
    created = await tx.bill.create({
      data: {
        organizationId: template.organizationId,
        vendorId: template.partyId,
        billNumber,
        status: 'draft',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        currency: 'USD',
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        lines: {
          create: lines.map((l, i) => ({
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            amount: totals.lineAmounts[i],
            accountId: l.accountId,
            productId: l.productId || null,
          })),
        },
      },
    })
  }

  await tx.recurringTemplate.update({
    where: { id: template.id },
    data: { lastRunAt: new Date(), nextRunDate: advanceDate(new Date(template.nextRunDate), template.frequency) },
  })

  await tx.auditEvent.create({
    data: {
      organizationId: template.organizationId,
      actorId,
      action: 'recurring_template.run',
      resourceType: 'recurring_template',
      resourceId: template.id,
      newState: { type: template.type, createdId: created.id },
    },
  })

  return created
}
