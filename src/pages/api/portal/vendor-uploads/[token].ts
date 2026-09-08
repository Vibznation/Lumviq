import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { resolveVendorUploadToken } from '../../../../lib/portal-tokens'
import { saveDocument } from '../../../../lib/documents'

export const config = {
  api: {
    bodyParser: { sizeLimit: '12mb' },
  },
}

/**
 * Public guest endpoint — no authentication. GET returns vendor/org info
 * for a valid token; POST accepts a base64-encoded bill/receipt upload
 * and stores it as a Document tagged to the vendor (uploadedByUserId is
 * left null since there is no authenticated user).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.query.token as string
  const resolved = await resolveVendorUploadToken(prisma, token)
  if (!resolved) return res.status(404).json({ error: 'This link is invalid or has expired' })

  if (req.method === 'GET') {
    return res.status(200).json({ vendor: { name: resolved.vendor?.name }, organization: resolved.organization })
  }

  if (req.method === 'POST') {
    const { fileName, mimeType, base64Data, notes } = req.body || {}
    if (!fileName || !mimeType || !base64Data) {
      return res.status(400).json({ error: 'fileName, mimeType and base64Data are required' })
    }
    try {
      const doc = await saveDocument({
        organizationId: resolved.organization.id,
        fileName,
        mimeType,
        base64Data,
        relatedType: 'vendor_upload',
        relatedId: resolved.vendor.id,
      })
      if (notes) {
        await prisma.auditEvent.create({
          data: {
            organizationId: resolved.organization.id,
            actorId: null,
            action: 'vendor_portal.upload',
            resourceType: 'document',
            resourceId: doc.id,
            newState: { vendorId: resolved.vendor.id, notes },
          },
        })
      }
      return res.status(201).json({ message: 'Upload received', documentId: doc.id })
    } catch (err: any) {
      return res.status(400).json({ error: err.message })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
