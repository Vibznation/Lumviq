import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'
import { configureDirectDeposit } from '../../../../lib/payroll-onboarding'
import { PayrollProviderNotConnectedError } from '../../../../lib/payroll-run'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const employee = await prisma.employee.findUnique({ where: { id } })
  if (!employee) return res.status(404).json({ error: 'Employee not found' })
  if (!(await userHasMembership(user.id, employee.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    const accounts = await prisma.directDepositAccount.findMany({
      where: { employeeId: id },
      orderBy: { priority: 'asc' },
      select: { id: true, bankName: true, accountType: true, accountLast4: true, splitType: true, splitValue: true, priority: true, verificationStatus: true, active: true },
    })
    return res.status(200).json(accounts)
  }

  if (req.method === 'POST') {
    const { routingNumber, accountNumber, bankName, accountType, splitType, splitValue, priority } = req.body || {}
    if (!routingNumber || !accountNumber) return res.status(400).json({ error: 'routingNumber and accountNumber are required' })
    if (!(await enforceAddOnGroup(res, prisma, employee.organizationId, 'payroll'))) return
    try {
      const { account, sandboxMicroDepositAmounts } = await prisma.$transaction((tx) =>
        configureDirectDeposit(tx, employee.organizationId, { employeeId: id }, { routingNumber, accountNumber, bankName, accountType, splitType, splitValue, priority })
      )
      const { routingNumberEncrypted, accountNumberEncrypted, ...safe } = account
      return res.status(201).json({ ...safe, sandboxMicroDepositAmounts })
    } catch (err: any) {
      if (err instanceof PayrollProviderNotConnectedError) return res.status(409).json({ error: err.message })
      return res.status(400).json({ error: err.message })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).end()
}
