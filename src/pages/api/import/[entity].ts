import type { NextApiRequest, NextApiResponse } from 'next'
import Papa from 'papaparse'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { IMPORT_TEMPLATES, ImportEntityType, validateImportRows, commitImportRows } from '../../../lib/import-export'

const ENTITY_TYPES = Object.keys(IMPORT_TEMPLATES) as ImportEntityType[]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const entityType = req.query.entity as string
  if (!ENTITY_TYPES.includes(entityType as ImportEntityType)) {
    return res.status(400).json({ error: `Unsupported import entity. Supported: ${ENTITY_TYPES.join(', ')}` })
  }

  const { organizationId, csvText, dryRun, fileName } = req.body || {}
  if (!organizationId || !csvText) return res.status(400).json({ error: 'organizationId and csvText are required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true })
  const rows = parsed.data
  const validated = validateImportRows(entityType as ImportEntityType, rows)
  const isDryRun = dryRun !== false

  const job = await prisma.importJob.create({
    data: {
      organizationId,
      entityType,
      status: 'processing',
      dryRun: isDryRun,
      fileName: fileName || null,
      totalRows: rows.length,
      createdByUserId: user.id,
    },
  })

  if (isDryRun) {
    const errorRows = validated.filter((r) => !r.ok)
    const completed = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'previewed',
        successRows: validated.length - errorRows.length,
        errorRows: errorRows.length,
        errors: errorRows as any,
        completedAt: new Date(),
      },
    })
    return res.status(200).json({ job: completed, preview: validated })
  }

  try {
    const result = await prisma.$transaction((tx) =>
      commitImportRows(tx, organizationId, entityType as ImportEntityType, validated)
    )
    const completed = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        successRows: result.successCount,
        errorRows: result.errorCount,
        errors: result.errors as any,
        completedAt: new Date(),
      },
    })
    return res.status(200).json({ job: completed, result })
  } catch (err: any) {
    const failed = await prisma.importJob.update({
      where: { id: job.id },
      data: { status: 'failed', completedAt: new Date() },
    })
    return res.status(400).json({ error: err.message, job: failed })
  }
}
