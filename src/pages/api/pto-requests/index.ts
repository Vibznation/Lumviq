import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

/**
 * Organization-wide PTO request queue (for manager review), optionally
 * filtered by status. Individual employee history lives at
 * GET /api/employees/[id]/pto-requests.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'GET') return res.status(405).end()

  const organizationId = req.query.organizationId as string | undefined
  const status = req.query.status as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const requests = await prisma.ptoRequest.findMany({
    where: { employee: { organizationId }, ...(status ? { status } : {}) },
    include: { employee: { select: { id: true, name: true } }, ptoPolicy: true },
    orderBy: { createdAt: 'desc' },
  })
  return res.status(200).json(requests)
}
