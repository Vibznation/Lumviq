import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'

/**
 * Approve or deny a pending PTO request. Approving deducts the
 * requested hours from the employee's matching PtoBalance (upserting a
 * zero-start balance if one doesn't exist yet, allowing it to go
 * negative rather than blocking the decision — Lumviq surfaces the
 * resulting balance but leaves any "insufficient balance" policy
 * enforcement to the organization).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'PATCH') return res.status(405).end()

  const id = req.query.id as string
  const request = await prisma.ptoRequest.findUnique({ where: { id }, include: { employee: true } })
  if (!request) return res.status(404).json({ error: 'PTO request not found' })
  if (!(await userHasMembership(user.id, request.employee.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceAddOnGroup(res, prisma, request.employee.organizationId, 'payroll'))) return

  if (request.status !== 'pending') {
    return res.status(409).json({ error: `Request has already been ${request.status}` })
  }

  const { status } = req.body || {}
  if (status !== 'approved' && status !== 'denied') {
    return res.status(400).json({ error: "status must be 'approved' or 'denied'" })
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (status === 'approved' && request.ptoPolicyId) {
      const existing = await tx.ptoBalance.findUnique({
        where: { employeeId_ptoPolicyId: { employeeId: request.employeeId, ptoPolicyId: request.ptoPolicyId } },
      })
      const newBalance = Number(existing?.balanceHours || 0) - Number(request.hours)
      await tx.ptoBalance.upsert({
        where: { employeeId_ptoPolicyId: { employeeId: request.employeeId, ptoPolicyId: request.ptoPolicyId } },
        update: { balanceHours: newBalance },
        create: { employeeId: request.employeeId, ptoPolicyId: request.ptoPolicyId, balanceHours: newBalance },
      })
    }
    return tx.ptoRequest.update({
      where: { id },
      data: { status, decidedByUserId: user.id, decidedAt: new Date() },
    })
  })

  return res.status(200).json(updated)
}
