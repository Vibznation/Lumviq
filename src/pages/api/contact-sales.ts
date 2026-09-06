import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../server/prisma'
import { validateContactSales } from '../../lib/contact-sales'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { ok, errors } = validateContactSales(req.body || {})
  if (!ok) return res.status(400).json({ error: 'Invalid submission', fields: errors })

  const {
    firstName,
    lastName,
    email,
    phone,
    organizationName,
    organizationType,
    employeeCount,
    currentSystem,
    requiredModules,
    preferredContact,
    message,
    consentAcknowledged,
  } = req.body

  const submission = await prisma.contactSalesSubmission.create({
    data: {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone ? String(phone).trim() : null,
      organizationName: String(organizationName).trim(),
      organizationType: organizationType ? String(organizationType) : null,
      employeeCount: employeeCount ? String(employeeCount) : null,
      currentSystem: currentSystem ? String(currentSystem) : null,
      requiredModules: Array.isArray(requiredModules) ? requiredModules.map(String) : [],
      preferredContact: preferredContact ? String(preferredContact) : null,
      message: message ? String(message).trim() : null,
      consentAcknowledged: !!consentAcknowledged,
    },
  })

  return res.status(201).json({ id: submission.id })
}
