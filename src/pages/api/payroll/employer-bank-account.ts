import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../lib/authorization'
import { enforceAddOnGroup } from '../../../lib/entitlements'
import { configureEmployerBankAccount } from '../../../lib/payroll-onboarding'
import { PayrollProviderNotConnectedError } from '../../../lib/payroll-run'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const organizationId = req.query.organizationId as string | undefined
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    const accounts = await prisma.directDepositAccount.findMany({
      where: { organizationId, ownerType: 'employer' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, bankName: true, accountType: true, accountLast4: true, verificationStatus: true, providerAccountId: true, createdAt: true },
    })
    return res.status(200).json(accounts)
  }

  if (req.method === 'POST') {
    const { organizationId, bankName, accountType, routingNumber, accountNumber } = req.body || {}
    if (!organizationId || !routingNumber || !accountNumber) {
      return res.status(400).json({ error: 'organizationId, routingNumber and accountNumber are required' })
    }
    if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })
    if (!(await enforceAddOnGroup(res, prisma, organizationId, 'payroll'))) return
    try {
      const { account, sandboxMicroDepositAmounts } = await prisma.$transaction((tx) =>
        configureEmployerBankAccount(tx, organizationId, { bankName, accountType, routingNumber, accountNumber })
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
