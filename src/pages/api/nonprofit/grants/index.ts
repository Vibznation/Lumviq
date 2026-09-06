import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { createGrant, recordGrantSpend } from '../../../../lib/nonprofit'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const grants = await prisma.grant.findMany({ where: { organizationId }, include: { fund: true }, orderBy: { startDate: 'desc' } })
    return res.status(200).json(grants)
  }

  if (req.method === 'POST') {
    const { organizationId, fundId, name, grantorName, totalAwarded, startDate, endDate } = req.body || {}
    if (!organizationId || !name || !grantorName || !totalAwarded || !startDate) {
      return res.status(400).json({ error: 'organizationId, name, grantorName, totalAwarded and startDate are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const grant = await prisma.$transaction((tx) =>
      createGrant(tx, { organizationId, fundId, name, grantorName, totalAwarded, startDate, endDate })
    )
    return res.status(201).json(grant)
  }

  if (req.method === 'PATCH') {
    const { grantId, spendAmount } = req.body || {}
    if (!grantId || !spendAmount) return res.status(400).json({ error: 'grantId and spendAmount are required' })
    const grant = await prisma.grant.findUnique({ where: { id: grantId } })
    if (!grant) return res.status(404).json({ error: 'Grant not found' })
    if (!(await userHasMembership(user.id, grant.organizationId))) return res.status(403).json({ error: 'Forbidden' })
    try {
      const updated = await prisma.$transaction((tx) => recordGrantSpend(tx, grantId, spendAmount))
      return res.status(200).json(updated)
    } catch (err: any) {
      return res.status(400).json({ error: err.message })
    }
  }

  return res.status(405).end()
}
