import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../../server/prisma'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { enforceAddOnGroup } from '../../../../lib/entitlements'
import { encryptField, last4, maskLast4 } from '../../../../lib/encryption'

/**
 * Full employee profile record: legal identity, residential address,
 * work location, employment status, hire date, compensation, pay
 * schedule, and encrypted SSN. Federal W-4/state withholding live on
 * EmployeeTaxProfile ([id]/tax-profile.ts); deductions/garnishments have
 * their own endpoints ([id]/deductions.ts, [id]/garnishments.ts);
 * direct deposit lives on [id]/direct-deposit.ts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.query.id as string
  const employee = await prisma.employee.findUnique({ where: { id } })
  if (!employee) return res.status(404).json({ error: 'Employee not found' })
  if (!(await userHasMembership(user.id, employee.organizationId))) return res.status(403).json({ error: 'Forbidden' })

  if (req.method === 'GET') {
    const { ssnEncrypted, ...rest } = employee
    return res.status(200).json({ ...rest, ssnMasked: employee.ssnLast4 ? maskLast4(employee.ssnLast4) : null })
  }

  if (req.method === 'PATCH') {
    if (!(await enforceAddOnGroup(res, prisma, employee.organizationId, 'payroll'))) return
    const body = req.body || {}
    const data: any = {}

    // Legal identity / contact
    if (body.name !== undefined) data.name = body.name
    if (body.preferredName !== undefined) data.preferredName = body.preferredName || null
    if (body.email !== undefined) data.email = body.email || null
    if (body.phone !== undefined) data.phone = body.phone || null

    // Residential address
    if (body.addressLine1 !== undefined) data.addressLine1 = body.addressLine1 || null
    if (body.addressLine2 !== undefined) data.addressLine2 = body.addressLine2 || null
    if (body.city !== undefined) data.city = body.city || null
    if (body.state !== undefined) data.state = body.state || null
    if (body.postalCode !== undefined) data.postalCode = body.postalCode || null

    // Legal identity: date of birth + encrypted SSN
    if (body.dateOfBirth !== undefined) data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null
    if (body.ssn) {
      data.ssnEncrypted = encryptField(body.ssn)
      data.ssnLast4 = last4(body.ssn)
    }

    // Compensation
    if (body.payType !== undefined) data.payType = body.payType
    if (body.rate !== undefined) data.rate = body.rate
    if (body.overtimeEligible !== undefined) data.overtimeEligible = Boolean(body.overtimeEligible)

    // Employment status / dates
    if (body.employmentStatus !== undefined) data.employmentStatus = body.employmentStatus
    if (body.hireDate !== undefined) data.hireDate = body.hireDate ? new Date(body.hireDate) : null
    if (body.terminationDate !== undefined) data.terminationDate = body.terminationDate ? new Date(body.terminationDate) : null

    // Org structure
    if (body.department !== undefined) data.department = body.department || null
    if (body.jobTitle !== undefined) data.jobTitle = body.jobTitle || null
    if (body.emergencyContactName !== undefined) data.emergencyContactName = body.emergencyContactName || null
    if (body.emergencyContactPhone !== undefined) data.emergencyContactPhone = body.emergencyContactPhone || null

    // Work location + pay schedule
    if (body.locationId !== undefined) {
      if (body.locationId) {
        const location = await prisma.location.findUnique({ where: { id: body.locationId } })
        if (!location || location.organizationId !== employee.organizationId) {
          return res.status(400).json({ error: 'Location does not belong to this organization' })
        }
      }
      data.locationId = body.locationId || null
    }
    if (body.payScheduleId !== undefined) {
      if (body.payScheduleId) {
        const schedule = await prisma.paySchedule.findUnique({ where: { id: body.payScheduleId } })
        if (!schedule || schedule.organizationId !== employee.organizationId) {
          return res.status(400).json({ error: 'Pay schedule does not belong to this organization' })
        }
      }
      data.payScheduleId = body.payScheduleId || null
    }
    if (body.managerId !== undefined) {
      if (body.managerId) {
        const manager = await prisma.employee.findUnique({ where: { id: body.managerId } })
        if (!manager || manager.organizationId !== employee.organizationId) {
          return res.status(400).json({ error: 'Manager does not belong to this organization' })
        }
      }
      data.managerId = body.managerId || null
    }

    const updated = await prisma.employee.update({ where: { id }, data })
    const { ssnEncrypted, ...rest } = updated
    return res.status(200).json({ ...rest, ssnMasked: updated.ssnLast4 ? maskLast4(updated.ssnLast4) : null })
  }

  res.setHeader('Allow', 'GET, PATCH')
  return res.status(405).end()
}
