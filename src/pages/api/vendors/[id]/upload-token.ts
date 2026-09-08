import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { createVendorUploadToken } from '../../../../lib/portal-tokens'

/** Creates a guest-access upload link for this vendor. Body: { expiresInDays? } */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const vendor = await prisma.vendor.findUnique({ where: { id } })
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' })
  if (!(await userHasMembership(user.id, vendor.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const { expiresInDays } = req.body || {}
  const record = await createVendorUploadToken(prisma, vendor.organizationId, id, expiresInDays || 30)
  const appUrl = process.env.APP_URL || ''
  return res.status(201).json({ ...record, portalUrl: `${appUrl}/portal/vendor-uploads/${record.token}` })
}
