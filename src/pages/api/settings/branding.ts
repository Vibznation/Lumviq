import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership, userHasPermission } from '../../../lib/authorization'

/**
 * Organization branding (logo + accent color) used on invoice PDFs and the
 * customer payment portal. Stored directly on Organization.logoUrl /
 * Organization.brandColor.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { logoUrl: true, brandColor: true } })
    return res.status(200).json(org || { logoUrl: null, brandColor: null })
  }

  if (req.method === 'PUT') {
    const { organizationId, logoUrl, brandColor } = req.body || {}
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await userHasPermission(user.id, organizationId, 'manage_organization'))) {
      return res.status(403).json({ error: 'Only an owner or admin can change organization branding' })
    }
    if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      return res.status(400).json({ error: 'brandColor must be a hex color like #0f766e' })
    }
    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: { logoUrl: logoUrl || null, brandColor: brandColor || null },
      select: { logoUrl: true, brandColor: true },
    })
    return res.status(200).json(org)
  }

  res.setHeader('Allow', 'GET, PUT')
  return res.status(405).end()
}
