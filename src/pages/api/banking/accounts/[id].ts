import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { requestApproval } from '../../../../lib/approvals'

/**
 * Editing an existing bank account's connection details. Changing the
 * account number (or provider) is a sensitive "banking-detail change" —
 * per docs/known-limitations.md this is always gated behind an approval
 * regardless of amount (there's no dollar amount to threshold against),
 * unlike the other Approval categories in src/lib/approvals.ts. Editing
 * just the display name/currency does not require approval.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const account = await prisma.bankAccount.findUnique({ where: { id } })
  if (!account) return res.status(404).json({ error: 'Bank account not found' })
  if (!(await userHasMembership(user.id, account.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') return res.status(200).json(account)

  if (req.method === 'PATCH') {
    const { name, provider, accountNumber, currency } = req.body || {}
    const changingSensitiveDetails =
      (accountNumber !== undefined && accountNumber !== account.accountNumber) ||
      (provider !== undefined && provider !== account.provider)

    if (changingSensitiveDetails) {
      const approval = await prisma.$transaction((tx) =>
        requestApproval(tx, {
          organizationId: account.organizationId,
          resourceType: 'banking-detail-change',
          resourceId: account.id,
          payload: { name, provider, accountNumber, currency },
          requestedByUserId: user.id,
          note: `Update banking details for ${account.name}`,
        })
      )
      return res.status(202).json({ requiresApproval: true, approval })
    }

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(currency !== undefined ? { currency } : {}),
      },
    })
    return res.status(200).json(updated)
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).end()
}
