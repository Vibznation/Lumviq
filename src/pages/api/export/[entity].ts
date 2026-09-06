import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { IMPORT_TEMPLATES, ImportEntityType, toCsv } from '../../../lib/import-export'

const ENTITY_TYPES = Object.keys(IMPORT_TEMPLATES) as ImportEntityType[]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const entityType = req.query.entity as string
  if (!ENTITY_TYPES.includes(entityType as ImportEntityType)) {
    return res.status(400).json({ error: `Unsupported export entity. Supported: ${ENTITY_TYPES.join(', ')}` })
  }

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const { columns } = IMPORT_TEMPLATES[entityType as ImportEntityType]
  let rows: Record<string, any>[] = []
  if (entityType === 'customers') rows = await prisma.customer.findMany({ where: { organizationId } })
  if (entityType === 'vendors') rows = await prisma.vendor.findMany({ where: { organizationId } })
  if (entityType === 'accounts') rows = await prisma.account.findMany({ where: { organizationId } })

  const csv = toCsv(columns, rows)
  await prisma.exportJob.create({
    data: { organizationId, entityType, status: 'completed', rowCount: rows.length, createdByUserId: user.id, completedAt: new Date() },
  })

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${entityType}.csv"`)
  return res.status(200).send(csv)
}
