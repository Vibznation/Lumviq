import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { readDocumentFile, deleteDocument } from '../../../lib/documents'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  if (!(await userHasMembership(user.id, doc.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    try {
      const buffer = await readDocumentFile(doc)
      res.setHeader('Content-Type', doc.mimeType)
      res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName.replace(/"/g, '')}"`)
      return res.status(200).send(buffer)
    } catch (err: any) {
      return res.status(404).json({ error: 'File not found on disk' })
    }
  }

  if (req.method === 'DELETE') {
    await deleteDocument(doc)
    return res.status(204).end()
  }

  return res.status(405).end()
}
