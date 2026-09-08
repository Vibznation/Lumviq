import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed']

/**
 * Support ticket status transitions. Any organization member can move a
 * ticket between the four statuses below — there is no restriction on
 * transition order (e.g. a closed ticket can be reopened by setting it
 * back to 'open').
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const { status } = req.body || {}
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } })
  if (!ticket) return res.status(404).json({ error: 'Support ticket not found' })
  if (!(await userHasMembership(user.id, ticket.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const updated = await prisma.supportTicket.update({ where: { id }, data: { status } })
  return res.status(200).json(updated)
}
