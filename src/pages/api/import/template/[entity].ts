import type { NextApiRequest, NextApiResponse } from 'next'
import { IMPORT_TEMPLATES, ImportEntityType } from '../../../../lib/import-export'

const ENTITY_TYPES = Object.keys(IMPORT_TEMPLATES) as ImportEntityType[]

/** Returns a downloadable CSV template (header row only) for an import entity type. Does not require auth since it contains no data. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const entityType = req.query.entity as string
  if (!ENTITY_TYPES.includes(entityType as ImportEntityType)) {
    return res.status(400).json({ error: `Unsupported entity. Supported: ${ENTITY_TYPES.join(', ')}` })
  }
  const { columns } = IMPORT_TEMPLATES[entityType as ImportEntityType]
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${entityType}-template.csv"`)
  return res.status(200).send(columns.join(','))
}
