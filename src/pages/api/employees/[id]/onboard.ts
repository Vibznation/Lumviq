import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'
import { onboardEmployeeWithProvider } from '../../../../lib/payroll-onboarding'
import { PayrollProviderNotConnectedError } from '../../../../lib/payroll-run'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const employee = await prisma.employee.findUnique({ where: { id } })
  if (!employee) return res.status(404).json({ error: 'Employee not found' })
  if (!(await userHasMembership(user.id, employee.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceAddOnGroup(res, prisma, employee.organizationId, 'payroll'))) return

  try {
    const updated = await prisma.$transaction((tx) => onboardEmployeeWithProvider(tx, employee.organizationId, id))
    return res.status(200).json(updated)
  } catch (err: any) {
    if (err instanceof PayrollProviderNotConnectedError) return res.status(409).json({ error: err.message })
    return res.status(400).json({ error: err.message })
  }
}
