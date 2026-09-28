import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mockEmailLogCreate = vi.fn().mockResolvedValue({ id: 'log-1', status: 'SENT' })

vi.mock('../src/server/prisma', () => ({
  default: {
    emailLog: {
      create: (...args: any[]) => mockEmailLogCreate(...args),
    },
  },
}))

import {
  sendEmail,
  getEmailProviderInfo,
  isEmailConfigured,
  resetEmailTransportForTesting,
} from '../src/lib/integrations/email'

describe('Email Delivery & Providers', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    mockEmailLogCreate.mockClear()
    resetEmailTransportForTesting()
  })

  afterEach(() => {
    process.env = originalEnv
    resetEmailTransportForTesting()
  })

  it('detects console mode when no credentials or sandbox mode are set', () => {
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_FROM
    delete process.env.EMAIL_FROM
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_PROVIDER_MODE

    const info = getEmailProviderInfo()
    expect(info.mode).toBe('none')
    expect(info.configured).toBe(false)
    expect(isEmailConfigured()).toBe(false)
  })

  it('detects sandbox mode when EMAIL_PROVIDER_MODE=sandbox', () => {
    process.env.EMAIL_PROVIDER_MODE = 'sandbox'
    delete process.env.SMTP_HOST
    delete process.env.RESEND_API_KEY

    const info = getEmailProviderInfo()
    expect(info.mode).toBe('sandbox')
    expect(info.configured).toBe(true)
    expect(isEmailConfigured()).toBe(true)
  })

  it('detects resend mode when RESEND_API_KEY is present', () => {
    process.env.RESEND_API_KEY = 're_test_123456789'
    delete process.env.SMTP_HOST
    delete process.env.EMAIL_PROVIDER_MODE

    const info = getEmailProviderInfo()
    expect(info.mode).toBe('resend')
    expect(info.configured).toBe(true)
    expect(isEmailConfigured()).toBe(true)
  })

  it('detects smtp mode when SMTP_HOST, SMTP_PORT and SMTP_FROM are present', () => {
    process.env.SMTP_HOST = 'smtp.sendgrid.net'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_FROM = 'noreply@lumviq.com'
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_PROVIDER_MODE

    const info = getEmailProviderInfo()
    expect(info.mode).toBe('smtp')
    expect(info.configured).toBe(true)
    expect(isEmailConfigured()).toBe(true)
  })

  it('delivers email via sandbox simulator and records log in database', async () => {
    process.env.EMAIL_PROVIDER_MODE = 'sandbox'

    const result = await sendEmail({
      to: 'recipient@example.com',
      subject: 'Welcome to Lumviq Sandbox',
      body: 'Hello, your sandbox account is active.',
      organizationId: 'org-test-1',
    })

    expect(result.status).toBe('sent')
    expect(result.provider).toBe('sandbox')
    expect(result.messageId).toContain('sandbox-')

    expect(mockEmailLogCreate).toHaveBeenCalledTimes(1)
    const logCall = mockEmailLogCreate.mock.calls[0][0]
    expect(logCall.data.organizationId).toBe('org-test-1')
    expect(logCall.data.toAddress).toBe('recipient@example.com')
    expect(logCall.data.subject).toBe('Welcome to Lumviq Sandbox')
    expect(logCall.data.provider).toBe('sandbox')
    expect(logCall.data.status).toBe('sent')
  })

  it('delivers email via console fallback and records log in database', async () => {
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_PROVIDER_MODE

    const result = await sendEmail({
      to: 'fallback@example.com',
      subject: 'Fallback Log Test',
      body: 'Logged to console and database.',
      organizationId: 'org-test-2',
    })

    expect(result.status).toBe('logged_only')
    expect(result.provider).toBe('console')

    expect(mockEmailLogCreate).toHaveBeenCalledTimes(1)
    const logCall = mockEmailLogCreate.mock.calls[0][0]
    expect(logCall.data.organizationId).toBe('org-test-2')
    expect(logCall.data.toAddress).toBe('fallback@example.com')
    expect(logCall.data.provider).toBe('console')
    expect(logCall.data.status).toBe('logged_only')
  })
})
