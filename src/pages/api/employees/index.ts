import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const employees = await prisma.employee.findMany({ where: { organizationId }, orderBy: { name: 'asc' } })
    return res.status(200).json(employees)
  }

  if (req.method === 'POST') {
    const { organizationId, name, email, payType, rate } = req.body || {}
    if (!organizationId || !name || rate == null) return res.status(400).json({ error: 'organizationId, name and rate are required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const employee = await prisma.employee.create({
      data: { organizationId, name, email: email || null, payType: payType || 'salary', rate },
    })
    return res.status(201).json(employee)
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
