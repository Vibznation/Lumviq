import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { runRecurringTemplate } from '../../../../lib/recurring'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const template = await prisma.recurringTemplate.findUnique({ where: { id } })
  if (!template) return res.status(404).json({ error: 'Recurring template not found' })
  if (!(await userHasMembership(user.id, template.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!template.active) return res.status(400).json({ error: 'This template is inactive' })

  const created = await prisma.$transaction((tx) => runRecurringTemplate(tx, template, user.id))
  return res.status(200).json(created)
}
