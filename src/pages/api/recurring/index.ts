import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const templates = await prisma.recurringTemplate.findMany({ where: { organizationId }, orderBy: { nextRunDate: 'asc' } })
    return res.status(200).json(templates)
  }

  if (req.method === 'POST') {
    const { organizationId, type, partyId, frequency, nextRunDate, taxRateId, templateLines } = req.body || {}
    if (!organizationId || !['invoice', 'bill'].includes(type) || !partyId || !nextRunDate) {
      return res.status(400).json({ error: 'organizationId, type (invoice|bill), partyId and nextRunDate are required' })
    }
    if (!Array.isArray(templateLines) || templateLines.length === 0) {
      return res.status(400).json({ error: 'At least one template line is required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

    const party = type === 'invoice'
      ? await prisma.customer.findUnique({ where: { id: partyId } })
      : await prisma.vendor.findUnique({ where: { id: partyId } })
    if (!party || party.organizationId !== organizationId) {
      return res.status(400).json({ error: `${type === 'invoice' ? 'Customer' : 'Vendor'} does not belong to this organization` })
    }

    const template = await prisma.recurringTemplate.create({
      data: {
        organizationId,
        type,
        partyId,
        frequency: frequency || 'monthly',
        nextRunDate: new Date(nextRunDate),
        taxRateId: taxRateId || null,
        templateLines,
      },
    })
    return res.status(201).json(template)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
