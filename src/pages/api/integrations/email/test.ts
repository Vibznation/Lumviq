import type { NextApiRequest, NextApiResponse } from 'next'
import { requireUserFromRequest, userHasMembership } from '../../../../lib/authorization'
import { sendEmail, getEmailProviderInfo } from '../../../../lib/integrations/email'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end()
  }

  const user = await requireUserFromRequest(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { organizationId, to } = req.body || {}
  if (!organizationId) return res.status(400).json({ error: 'organizationId required' })
  if (!(await userHasMembership(user.id, organizationId))) return res.status(403).json({ error: 'Forbidden' })

  const recipient = to?.trim() || user.email
  if (!recipient) return res.status(400).json({ error: 'Recipient email is required' })

  const provider = getEmailProviderInfo()

  try {
    const result = await sendEmail({
      organizationId,
      to: recipient,
      subject: `Lumviq Test Email (${provider.name})`,
      body: `Hello,\n\nThis is a verification test email from your Lumviq workspace (${organizationId}).\nEmail provider mode: ${provider.mode} (${provider.name}).\nSent at: ${new Date().toISOString()}`,
    })

    return res.status(200).json({
      success: result.status === 'sent',
      provider: result.provider,
      status: result.status,
      messageId: result.messageId,
      error: result.error,
      recipient,
    })
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to send test email' })
  }
}
