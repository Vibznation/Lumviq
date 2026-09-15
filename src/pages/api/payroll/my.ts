import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../server/prisma'
import { requireUserFromRequest } from '../../../lib/authorization'

/**
 * Employee self-service profile: returns only the Employee record linked
 * to the currently authenticated user (Employee.userId === user.id) within
 * the given organization — never any other employee's data. SSN and bank
 * details are always masked to last 4 digits here, regardless of role.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const organizationId = req.query.organizationId as string | undefined
  if (!organizationId) return res.status(400).json({ error: 'organizationId is required' })

  const employee = await prisma.employee.findFirst({ where: { organizationId, userId: user.id } })
  if (!employee) return res.status(404).json({ error: 'No employee record is linked to your account in this organization' })

  const [taxProfile, directDeposits] = await Promise.all([
    prisma.employeeTaxProfile.findUnique({ where: { employeeId: employee.id } }),
    prisma.directDepositAccount.findMany({
      where: { employeeId: employee.id },
      select: { id: true, bankName: true, accountType: true, accountLast4: true, splitType: true, splitValue: true, verificationStatus: true, active: true },
    }),
  ])

  const { ssnEncrypted, ...safeEmployee } = employee
  const safeTaxProfile = taxProfile
    ? {
        filingStatus: taxProfile.filingStatus,
        federalAllowances: taxProfile.federalAllowances,
        state: taxProfile.state,
        stateFilingStatus: taxProfile.stateFilingStatus,
        exemptFromFederal: taxProfile.exemptFromFederal,
        exemptFromState: taxProfile.exemptFromState,
      }
    : null

  return res.status(200).json({ employee: safeEmployee, taxProfile: safeTaxProfile, directDeposits })
}
