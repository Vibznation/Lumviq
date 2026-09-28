/**
 * Outbound email delivery adapter and multi-provider dispatcher.
 * Every send is logged to the `EmailLog` database table regardless of outcome.
 *
 * Supported Provider Modes:
 * 1. SMTP: Configured via SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * 2. Resend: Configured via RESEND_API_KEY and (optional) RESEND_FROM / SMTP_FROM.
 * 3. Sandbox: Enabled when EMAIL_PROVIDER_MODE='sandbox'. Simulates successful delivery for dev/testing.
 * 4. Console (logged_only): Default fallback when no provider is configured.
 */
import prisma from '../../server/prisma'

export interface EmailMessage {
  organizationId?: string | null
  to: string
  subject: string
  body: string
  html?: string
}

export interface EmailSendResult {
  provider: string
  status: 'sent' | 'logged_only' | 'failed'
  error?: string
  messageId?: string
}

export type EmailProviderMode = 'smtp' | 'resend' | 'sandbox' | 'none'

export interface EmailProviderInfo {
  mode: EmailProviderMode
  name: string
  configured: boolean
  fromAddress?: string
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && (process.env.SMTP_FROM || process.env.EMAIL_FROM))
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

export function isEmailConfigured(): boolean {
  const mode = (process.env.EMAIL_PROVIDER_MODE || '').toLowerCase()
  if (mode === 'sandbox') return true
  return isSmtpConfigured() || isResendConfigured()
}

export function resetEmailTransportForTesting() {
  // No-op hook for test resetting
}

export function getEmailProviderInfo(): EmailProviderInfo {
  const modeEnv = (process.env.EMAIL_PROVIDER_MODE || '').toLowerCase()
  if (modeEnv === 'sandbox') {
    return {
      mode: 'sandbox',
      name: 'Sandbox Email Simulator',
      configured: true,
      fromAddress: 'notifications@sandbox.lumviq.local',
    }
  }

  if (isResendConfigured()) {
    return {
      mode: 'resend',
      name: 'Resend API',
      configured: true,
      fromAddress: process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.EMAIL_FROM || 'notifications@lumviq.com',
    }
  }

  if (isSmtpConfigured()) {
    return {
      mode: 'smtp',
      name: `SMTP Relay (${process.env.SMTP_HOST})`,
      configured: true,
      fromAddress: process.env.SMTP_FROM || process.env.EMAIL_FROM || 'notifications@lumviq.com',
    }
  }

  return {
    mode: 'none',
    name: 'Console (Logged Only)',
    configured: false,
  }
}

async function sendViaSandbox(message: EmailMessage): Promise<EmailSendResult> {
  const simulatedId = `sandbox-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  // eslint-disable-next-line no-console
  console.log(`[email:sandbox] Delivered to=${message.to} subject="${message.subject}" (id=${simulatedId})`)
  return { provider: 'sandbox', status: 'sent', messageId: simulatedId }
}

async function sendViaResend(message: EmailMessage): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.EMAIL_FROM || 'Lumviq <notifications@lumviq.com>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.body,
        html: message.html || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Resend API request failed')
    }
    return { provider: 'resend', status: 'sent', messageId: data.id }
  } catch (err: any) {
    return { provider: 'resend', status: 'failed', error: err?.message ?? String(err) }
  }
}

async function sendViaSmtp(message: EmailMessage): Promise<EmailSendResult> {
  let nodemailer: any
  try {
    nodemailer = require('nodemailer')
  } catch {
    return { provider: 'smtp', status: 'failed', error: 'nodemailer is not installed; run npm install nodemailer' }
  }
  try {
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || 'notifications@lumviq.com'
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
    const info = await transport.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.body,
      html: message.html || undefined,
    })
    return { provider: 'smtp', status: 'sent', messageId: info?.messageId }
  } catch (err: any) {
    return { provider: 'smtp', status: 'failed', error: err?.message ?? String(err) }
  }
}

/** Sends (or logs) an email and records an EmailLog row. */
export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const providerInfo = getEmailProviderInfo()
  let result: EmailSendResult

  if (providerInfo.mode === 'sandbox') {
    result = await sendViaSandbox(message)
  } else if (providerInfo.mode === 'resend') {
    result = await sendViaResend(message)
  } else if (providerInfo.mode === 'smtp') {
    result = await sendViaSmtp(message)
  } else {
    result = { provider: 'console', status: 'logged_only' }
    // eslint-disable-next-line no-console
    console.log(`[email:logged_only] to=${message.to} subject=${JSON.stringify(message.subject)}`)
  }

  try {
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
  } catch (logErr: any) {
    // eslint-disable-next-line no-console
    console.error('Failed to write EmailLog record:', logErr?.message || logErr)
  }

  return result
}
