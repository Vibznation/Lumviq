/**
 * Proof-of-completion: the inbound payroll webhook route
 * (src/pages/api/webhooks/payroll.ts) genuinely verifies signatures via
 * the real (sandbox) provider adapter and is idempotent at the
 * (provider, externalEventId) level — replaying the same signed event
 * twice must not reprocess it or re-sync the pay run a second time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'crypto'
import { Readable } from 'stream'

const WEBHOOK_SECRET = 'test-webhook-secret'

vi.mock('../src/lib/payroll-run', () => ({
  syncPayRunStatus: vi.fn(async () => ({ status: 'completed' })),
}))

vi.mock('../src/server/prisma', () => ({
  default: {
    payrollWebhookEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    payRun: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn({})),
  },
}))

import prisma from '../src/server/prisma'
import { syncPayRunStatus } from '../src/lib/payroll-run'
import webhookHandler from '../src/pages/api/webhooks/payroll'

function makeReq(body: string, signature: string | undefined) {
  const req: any = Readable.from([Buffer.from(body)])
  req.method = 'POST'
  req.headers = signature !== undefined ? { 'x-payroll-signature': signature } : {}
  return req
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) { this.statusCode = code; return this },
    json(payload: any) { this.body = payload; return this },
    end() { return this },
  }
  return res
}

describe('payroll webhook route: signature verification + idempotency (proof of completion)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PAYROLL_PROVIDER_MODE = 'sandbox'
    process.env.PAYROLL_WEBHOOK_SECRET = WEBHOOK_SECRET
    ;(prisma.payrollWebhookEvent.findUnique as any).mockResolvedValue(null)
    ;(prisma.payrollWebhookEvent.create as any).mockImplementation(async ({ data }: any) => ({ id: 'wh1', ...data }))
    ;(prisma.payrollWebhookEvent.update as any).mockResolvedValue({})
    ;(prisma.payRun.findFirst as any).mockResolvedValue({ id: 'pr1', organizationId: 'org-1' })
  })
  afterEach(() => {
    delete process.env.PAYROLL_PROVIDER_MODE
    delete process.env.PAYROLL_WEBHOOK_SECRET
  })

  it('rejects a webhook with an invalid signature (real HMAC verification via the sandbox provider)', async () => {
    const body = JSON.stringify({ id: 'evt-bad', type: 'payroll.paid', providerPayrollId: 'sandbox_run_1' })
    const req = makeReq(body, 'not-the-real-signature')
    const res = makeRes()
    await webhookHandler(req, res)
    expect(res.statusCode).toBe(401)
    expect(prisma.payrollWebhookEvent.create).not.toHaveBeenCalled()
  })

  it('processes a correctly signed webhook exactly once, then short-circuits as alreadyProcessed on replay', async () => {
    const payload = { id: 'evt-1', type: 'payroll.paid', providerPayrollId: 'sandbox_run_1' }
    const body = JSON.stringify(payload)
    const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')

    const req1 = makeReq(body, signature)
    const res1 = makeRes()
    await webhookHandler(req1, res1)

    expect(res1.statusCode).toBe(200)
    expect(res1.body).toEqual({ received: true, matched: true })
    expect(prisma.payrollWebhookEvent.create).toHaveBeenCalledTimes(1)
    expect(syncPayRunStatus).toHaveBeenCalledTimes(1)

    // Simulate the event now existing (as it would in the real DB after the first call).
    ;(prisma.payrollWebhookEvent.findUnique as any).mockResolvedValue({ id: 'wh1', provider: 'sandbox', externalEventId: 'evt-1' })

    const req2 = makeReq(body, signature)
    const res2 = makeRes()
    await webhookHandler(req2, res2)

    expect(res2.statusCode).toBe(200)
    expect(res2.body).toEqual({ received: true, alreadyProcessed: true })
    // No reprocessing: neither a new webhook-event row nor a second pay-run sync.
    expect(prisma.payrollWebhookEvent.create).toHaveBeenCalledTimes(1)
    expect(syncPayRunStatus).toHaveBeenCalledTimes(1)
  })

  it('acknowledges but does not sync when no matching pay run is found', async () => {
    ;(prisma.payRun.findFirst as any).mockResolvedValue(null)
    const payload = { id: 'evt-unmatched', type: 'payroll.paid', providerPayrollId: 'sandbox_run_unknown' }
    const body = JSON.stringify(payload)
    const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')

    const req = makeReq(body, signature)
    const res = makeRes()
    await webhookHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ received: true, matched: false })
    expect(syncPayRunStatus).not.toHaveBeenCalled()
  })
})
