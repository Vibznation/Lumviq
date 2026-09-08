/**
 * Outbound email delivery. Every send is logged to EmailLog regardless of
 * outcome. When no SMTP is configured (SMTP_HOST/SMTP_PORT/SMTP_USER/
 * SMTP_PASS/SMTP_FROM in .env.local), emails are logged only — never
 * silently "pretend-sent". This mirrors the honest-integration-disclosure
 * pattern used for payments/bank-feeds (see src/lib/integrations/).
 *
 * When SMTP env vars ARE configured, a real message is sent via
 * nodemailer's SMTP transport (works with any SMTP provider — Postmark,
 * SendGrid SMTP relay, Mailgun SMTP, Amazon SES SMTP, or a real mailbox).
 */
import prisma from '../../server/prisma'

export interface EmailMessage {
  organizationId?: string | null
  to: string
  subject: string
  body: string
}

export interface EmailSendResult {
  provider: string
  status: 'sent' | 'logged_only' | 'failed'
  error?: string
}

function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM)
}

async function sendViaSmtp(message: EmailMessage): Promise<EmailSendResult> {
  // Lazy require so the (optional) nodemailer dependency is only touched
  // when SMTP is actually configured; if it isn't installed, fall back to
  // logged_only with a clear error rather than crashing the caller.
  let nodemailer: any
  try {
    nodemailer = require('nodemailer')
  } catch {
    return { provider: 'smtp', status: 'failed', error: 'nodemailer is not installed; run npm install nodemailer' }
  }
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      text: message.body,
    })
    return { provider: 'smtp', status: 'sent' }
  } catch (err: any) {
    return { provider: 'smtp', status: 'failed', error: err?.message ?? String(err) }
  }
}

/** Sends (or logs) an email and always records an EmailLog row. */
export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const result: EmailSendResult = isSmtpConfigured()
    ? await sendViaSmtp(message)
    : { provider: 'console', status: 'logged_only' }

  if (result.provider === 'console') {
    // eslint-disable-next-line no-console
    console.log(`[email:logged_only] to=${message.to} subject=${JSON.stringify(message.subject)}`)
  }

  await prisma.emailLog.create({
    data: {
      organizationId: message.organizationId ?? null,
      toAddress: message.to,
      subject: message.subject,
      body: message.body,
      provider: result.provider,
      status: result.status,
      error: result.error,
    },
  })

  return result
}
