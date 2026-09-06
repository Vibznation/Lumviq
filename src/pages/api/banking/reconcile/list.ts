import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) {
    const sessions = await prisma.reconciliationSession.findMany({ orderBy: { createdAt: 'desc' } })
    return res.status(200).json(sessions)
  }
  const sessions = await prisma.reconciliationSession.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } })
  return res.status(200).json(sessions)
}
