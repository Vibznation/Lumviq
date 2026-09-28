import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceFeature } from '../../../lib/entitlements'
import { generate1099AnnualReport, format1099ReportCsv } from '../../../lib/tax-1099'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).end()
  }

  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : ''
  const yearParam = typeof req.query.year === 'string' ? parseInt(req.query.year, 10) : new Date().getFullYear()
  const format = typeof req.query.format === 'string' ? req.query.format : 'json'

  if (!organizationId) return res.status(400).json({ error: 'organizationId required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceFeature(res, prisma, organizationId, 'reports.tax-summary'))) return

  const taxYear = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear()

  try {
    const report = await generate1099AnnualReport(prisma, { organizationId, taxYear })

    if (format === 'csv') {
      const csv = format1099ReportCsv(report)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="1099-NEC-Summary-${taxYear}.csv"`)
      return res.status(200).send(csv)
    }

    return res.status(200).json(report)
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to generate 1099 report' })
  }
}
