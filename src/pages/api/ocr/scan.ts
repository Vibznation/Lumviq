import type { NextApiRequest, NextApiResponse } from 'next'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { getOcrProvider } from '../../../lib/integrations/ocr'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { organizationId, fileBase64, mimeType } = req.body || {}
  if (!organizationId || !fileBase64) {
    return res.status(400).json({ error: 'organizationId and fileBase64 are required' })
  }

  if (!(await userHasMembership(user.id, organizationId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const provider = getOcrProvider()
  if (!provider || !provider.isConfigured()) {
    return res.status(503).json({ error: 'OCR scanning provider is not configured' })
  }

  try {
    const buffer = Buffer.from(fileBase64, 'base64')
    const extracted = await provider.extractFromDocument(buffer, mimeType || 'image/png')

    return res.status(200).json({
      success: true,
      provider: provider.name,
      extracted,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'OCR processing failed' })
  }
}
