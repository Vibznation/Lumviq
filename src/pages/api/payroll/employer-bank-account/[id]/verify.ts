import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../../lib/entitlements'
import { verifyEmployerBankAccount } from '../../../../../lib/payroll-onboarding'
import { PayrollProviderNotConnectedError } from '../../../../../lib/payroll-run'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const account = await prisma.directDepositAccount.findUnique({ where: { id } })
  if (!account || account.ownerType !== 'employer') return res.status(404).json({ error: 'Employer bank account not found' })
  if (!(await userHasMembership(user.id, account.organizationId))) return res.status(403).json({ error: 'Forbidden' })
  if (!(await enforceAddOnGroup(res, prisma, account.organizationId, 'payroll'))) return

  const { amounts } = req.body || {}
  if (!Array.isArray(amounts) || amounts.length !== 2) return res.status(400).json({ error: 'amounts must be a two-element array of deposit amounts' })

  try {
    const updated = await prisma.$transaction((tx) => verifyEmployerBankAccount(tx, account.organizationId, id, amounts as [string, string]))
    const { routingNumberEncrypted, accountNumberEncrypted, ...safe } = updated
    return res.status(200).json(safe)
  } catch (err: any) {
    if (err instanceof PayrollProviderNotConnectedError) return res.status(409).json({ error: err.message })
    return res.status(400).json({ error: err.message })
  }
}
