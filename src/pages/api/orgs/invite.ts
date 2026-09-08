import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasPermission } from '../../../lib/authorization'
import { v4 as uuidv4 } from 'uuid'
import { enqueueJob } from '../../../lib/jobs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { organizationId, email, role } = req.body
  if (!organizationId || !email) return res.status(400).json({ error: 'organizationId and email required' })
  // simple permission check: only members with invite permission or owners
  const ok = await userHasPermission(user.id, organizationId, 'invite_members')
  if (!ok) return res.status(403).json({ error: 'Forbidden' })
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

