import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'
import { SandboxPayrollProvider, getPayrollProvider } from '../src/lib/integrations/payroll-sandbox'
import type { PayrollCalculationRequest } from '../src/lib/integrations/payroll'

describe('SandboxPayrollProvider', () => {
  let provider: SandboxPayrollProvider

  beforeEach(() => {
    provider = new SandboxPayrollProvider()
  })

  const request: PayrollCalculationRequest = {
    companyExternalId: 'co1',
    payPeriodStart: '2026-01-01',
    payPeriodEnd: '2026-01-15',
    lines: [{ employeeExternalId: 'emp1', grossPay: '1000.00' }],
  }

  it('calculates deterministic non-authoritative flat-rate taxes for a run', async () => {
    const result = await provider.calculatePayroll(request)
    expect(result.status).toBe('calculated')
    expect(result.totalGross).toBe('1000.00')
    expect(Number(result.totalEmployeeTax)).toBeGreaterThan(0)
    expect(Number(result.totalEmployerTax)).toBeGreaterThan(0)
    expect(result.lines).toHaveLength(1)
    expect(result.warnings).toEqual([])
  })

  it('flags negative gross pay as needs_attention', async () => {
    const result = await provider.calculatePayroll({
      ...request,
      lines: [{ employeeExternalId: 'emp1', grossPay: '-5' }],
    })
    expect(result.status).toBe('needs_attention')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('progresses a run through approve -> submitted -> retrieve -> paid', async () => {
    const calc = await provider.calculatePayroll(request)
    const submission = await provider.approvePayroll(calc.providerPayrollId)
    expect(submission.status).toBe('submitted')
    const retrieved = await provider.retrievePayroll(calc.providerPayrollId)
    expect(retrieved.status).toBe('paid')
  })

  it('throws for an unknown providerPayrollId', async () => {
    await expect(provider.retrievePayroll('does-not-exist')).rejects.toThrow('Sandbox payroll run not found')
  })

  it('voids and cancels a run', async () => {
    const calc = await provider.calculatePayroll(request)
    const voided = await provider.voidPayroll(calc.providerPayrollId)
    expect(voided.status).toBe('failed')
  })

  describe('handleWebhook', () => {
    const secret = 'test-webhook-secret'
    beforeEach(() => {
      process.env.PAYROLL_WEBHOOK_SECRET = secret
    })
    afterEach(() => {
      delete process.env.PAYROLL_WEBHOOK_SECRET
    })

    it('accepts a correctly signed payload', () => {
      const body = JSON.stringify({ id: 'evt1', type: 'payroll.paid' })
      const signature = createHmac('sha256', secret).update(body).digest('hex')
      const event = provider.handleWebhook(body, signature)
      expect(event.externalEventId).toBe('evt1')
      expect(event.eventType).toBe('payroll.paid')
    })

    it('rejects a payload with an invalid signature', () => {
      const body = JSON.stringify({ id: 'evt1', type: 'payroll.paid' })
      expect(() => provider.handleWebhook(body, 'deadbeef')).toThrow(/Invalid payroll webhook signature/)
    })

    it('rejects a payload with no signature header', () => {
      const body = JSON.stringify({ id: 'evt1', type: 'payroll.paid' })
      expect(() => provider.handleWebhook(body, undefined)).toThrow(/Invalid payroll webhook signature/)
    })
  })
})

describe('getPayrollProvider', () => {
  const originalMode = process.env.PAYROLL_PROVIDER_MODE
  afterEach(() => {
    process.env.PAYROLL_PROVIDER_MODE = originalMode
  })

  it('returns undefined when PAYROLL_PROVIDER_MODE is not set to sandbox', () => {
    delete process.env.PAYROLL_PROVIDER_MODE
    expect(getPayrollProvider()).toBeUndefined()
  })

  it('returns a configured sandbox provider when PAYROLL_PROVIDER_MODE=sandbox', () => {
    process.env.PAYROLL_PROVIDER_MODE = 'sandbox'
    const provider = getPayrollProvider()
    expect(provider).toBeDefined()
    expect(provider!.isConfigured()).toBe(true)
    expect(provider!.name).toBe('sandbox')
  })
})
