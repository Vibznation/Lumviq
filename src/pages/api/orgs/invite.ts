import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasPermission } from '../../../lib/authorization'
import { v4 as uuidv4 } from 'uuid'
import { enqueueJob } from '../../../lib/jobs'
import { enforceLimit } from '../../../lib/entitlements'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { organizationId, email, role } = req.body
  if (!organizationId || !email) return res.status(400).json({ error: 'organizationId and email required' })
  // simple permission check: only members with invite permission or owners
  const ok = await userHasPermission(user.id, organizationId, 'invite_members')
  if (!ok) return res.status(403).json({ error: 'Forbidden' })

  // A pending invitation reserves a seat the same way an accepted one does,
  // so a plan's user/accountant-invitation limit can't be bypassed by
  // sending far more invites than the plan allows and letting them sit
  // unaccepted.
  if (role === 'accountant') {
    const accountantCount = await prisma.organizationMembership.count({ where: { organizationId, role: 'accountant' } })
    const pendingAccountantInvites = await prisma.organizationInvitation.count({ where: { organizationId, role: 'accountant' } })
    if (!(await enforceLimit(res, prisma, organizationId, 'accountantInvitations', accountantCount + pendingAccountantInvites))) return
  } else {
    const memberCount = await prisma.organizationMembership.count({ where: { organizationId } })
    const pendingInvites = await prisma.organizationInvitation.count({ where: { organizationId, role: { not: 'accountant' } } })
    if (!(await enforceLimit(res, prisma, organizationId, 'users', memberCount + pendingInvites))) return
  }

  const token = uuidv4()
  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.organizationInvitation.create({ data: { organizationId, email, token, role: role || 'member' } })
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    await enqueueJob(tx, {
      organizationId,
      type: 'email.send',
      payload: {
        organizationId,
        to: email,
        subject: `You've been invited to join a Lumviq organization`,
        body: `You've been invited to join as ${role || 'member'}. Accept your invite: ${appUrl}/accept-invite?token=${token}`,
      },
    })
    return created
  })
  return res.status(201).json({ id: invite.id, token })
}

