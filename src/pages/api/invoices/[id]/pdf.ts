import type { NextApiRequest, NextApiResponse } from 'next'
import PDFDocument from 'pdfkit'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'

function currency(n: unknown, code: string) {
  return `${code} ${Number(n).toFixed(2)}`
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lines: { include: { account: true } }, customer: true, organization: true },
  })
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
  if (!(await userHasMembership(user.id, invoice.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`)

  const brandColor = invoice.organization.brandColor || '#0f766e'
  const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
  doc.pipe(res)

  doc.fillColor(brandColor).fontSize(20).text(invoice.organization.name, { continued: false })
  doc.fillColor('black').fontSize(10).moveDown(0.5)
  doc.fontSize(16).fillColor(brandColor).text(`Invoice ${invoice.invoiceNumber}`)
  doc.fillColor('black').fontSize(10).moveDown(1)

  doc.text(`Bill to: ${invoice.customer.name}`)
  if (invoice.customer.email) doc.text(invoice.customer.email)
  doc.moveDown(0.5)
  doc.text(`Issue date: ${new Date(invoice.issueDate).toDateString()}`)
  doc.text(`Due date: ${new Date(invoice.dueDate).toDateString()}`)
  if (invoice.paymentTerms) doc.text(`Terms: ${invoice.paymentTerms}`)
  doc.moveDown(1)

  const tableTop = doc.y
  doc.fontSize(10).fillColor(brandColor)
  doc.text('Description', 50, tableTop, { width: 220 })
  doc.text('Qty', 270, tableTop, { width: 50, align: 'right' })
  doc.text('Unit price', 320, tableTop, { width: 80, align: 'right' })
  doc.text('Discount', 400, tableTop, { width: 70, align: 'right' })
  doc.text('Amount', 470, tableTop, { width: 80, align: 'right' })
  doc.fillColor('black')
  doc.moveDown(0.5)
  let y = doc.y
  for (const line of invoice.lines) {
    doc.text(line.description, 50, y, { width: 220 })
    doc.text(Number(line.quantity).toString(), 270, y, { width: 50, align: 'right' })
    doc.text(Number(line.unitPrice).toFixed(2), 320, y, { width: 80, align: 'right' })
    doc.text(Number(line.discount).toFixed(2), 400, y, { width: 70, align: 'right' })
    doc.text(Number(line.amount).toFixed(2), 470, y, { width: 80, align: 'right' })
    y = doc.y + 14
    doc.moveDown(0.9)
  }

  doc.moveDown(1)
  doc.text(`Subtotal: ${currency(invoice.subtotal, invoice.currency)}`, { align: 'right' })
  doc.text(`Tax: ${currency(invoice.taxTotal, invoice.currency)}`, { align: 'right' })
  doc.fontSize(12).fillColor(brandColor).text(`Total: ${currency(invoice.total, invoice.currency)}`, { align: 'right' })
  doc.fillColor('black').fontSize(10).text(`Amount paid: ${currency(invoice.amountPaid, invoice.currency)}`, { align: 'right' })
  doc.text(`Balance due: ${currency(Number(invoice.total) - Number(invoice.amountPaid), invoice.currency)}`, { align: 'right' })

  doc.end()
}
