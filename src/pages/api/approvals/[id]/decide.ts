import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasPermission } from '../../../../lib/authorization'
import { decideApproval } from '../../../../lib/approvals'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const { decision, note } = req.body || {}
  if (decision !== 'approved' && decision !== 'rejected') {
    return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" })
  }

  const approval = await prisma.approval.findUnique({ where: { id } })
  if (!approval) return res.status(404).json({ error: 'Approval not found' })
  // Deciding a pending approval is an "approver" action, not plain
  // membership: owners always qualify (userHasPermission's built-in
  // bypass); other members need the `approvals.decide` permission
  // explicitly granted via a custom role (see permissions-matrix.md).
  if (!(await userHasPermission(user.id, approval.organizationId, 'approvals.decide'))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const result = await prisma.$transaction((tx) =>
      decideApproval(tx, { approvalId: id, decidedByUserId: user.id, decision, note })
    )
    return res.status(200).json(result)
  } catch (err: any) {
    return res.status(400).json({ error: err.message })
  }
}
