import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { eliminateIntercompanyTransaction } from '../../../lib/consolidation'

/** Body: { action: 'eliminate' } */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const record = await prisma.intercompanyTransaction.findUnique({ where: { id } })
  if (!record) return res.status(404).json({ error: 'Intercompany transaction not found' })
  if (!(await userHasMembership(user.id, record.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const { action } = req.body || {}
  if (action !== 'eliminate') return res.status(400).json({ error: "action must be 'eliminate'" })

  const updated = await eliminateIntercompanyTransaction(prisma, id)
  return res.status(200).json(updated)
}
