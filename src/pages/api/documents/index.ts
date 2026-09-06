import type { NextApiRequest, NextApiResponse } from 'next'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { saveDocument, listDocuments } from '../../../lib/documents'

export const config = {
  api: {
    bodyParser: { sizeLimit: '12mb' },
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const docs = await listDocuments(
      organizationId,
      req.query.relatedType as string | undefined,
      req.query.relatedId as string | undefined
    )
    return res.status(200).json(docs)
  }

  if (req.method === 'POST') {
    const { organizationId, fileName, mimeType, base64Data, relatedType, relatedId } = req.body || {}
    if (!organizationId || !fileName || !mimeType || !base64Data) {
      return res.status(400).json({ error: 'organizationId, fileName, mimeType and base64Data are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    try {
      const doc = await saveDocument({
        organizationId,
        fileName,
        mimeType,
        base64Data,
        relatedType: relatedType || null,
        relatedId: relatedId || null,
        uploadedByUserId: user.id,
      })
      return res.status(201).json(doc)
    } catch (err: any) {
      return res.status(400).json({ error: err.message })
    }
  }

  return res.status(405).end()
}
