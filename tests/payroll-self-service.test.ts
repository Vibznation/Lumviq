/**
 * Proof-of-completion: authorization/isolation guarantees for payroll
 * surfaces, exercised against the REAL API route handler modules (not
 * just the underlying lib functions) so these tests genuinely prove:
 *
 *  1. A user who is not a member of the organization gets HTTP 403 from
 *     a payroll-gated route (never silently succeeds or leaks data).
 *  2. The employee self-service routes (/api/payroll/my,
 *     /api/payroll/my/paystubs) are isolated by construction: they
 *     resolve the caller's own Employee record via
 *     { organizationId, userId: user.id } and never accept or honor a
 *     client-supplied employeeId, so employee A can never fetch employee
 *     B's profile or paystubs even by tampering with query parameters.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/server/prisma', () => ({
  default: {
    employee: { findFirst: vi.fn(), findMany: vi.fn() },
    employeeTaxProfile: { findUnique: vi.fn() },
    directDepositAccount: { findMany: vi.fn() },
    payStub: { findMany: vi.fn() },
  },
}))

vi.mock('../src/lib/authorization', () => ({
  requireUserFromRequest: vi.fn(),
  userHasMembership: vi.fn(),
}))

import prisma from '../src/server/prisma'
import { requireUserFromRequest, userHasMembership } from '../src/lib/authorization'
import employeesHandler from '../src/pages/api/employees/index'
import myProfileHandler from '../src/pages/api/payroll/my'
import myPaystubsHandler from '../src/pages/api/payroll/my/paystubs'

function makeReqRes(opts: { method?: string; query?: Record<string, string>; body?: any } = {}) {
  const req: any = { method: opts.method ?? 'GET', query: opts.query ?? {}, body: opts.body ?? {}, headers: { authorization: 'Bearer test-token' } }
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) { this.statusCode = code; return this },
    json(payload: any) { this.body = payload; return this },
    end() { return this },
    setHeader() { return this },
  }
  return { req, res }
}

const ORG = 'org-1'

describe('payroll security: permissions and employee isolation (proof of completion)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 Forbidden for a user who is not a member of the organization', async () => {
    ;(requireUserFromRequest as any).mockResolvedValue({ id: 'user-outsider' })
    ;(userHasMembership as any).mockResolvedValue(false)

    const { req, res } = makeReqRes({ method: 'GET', query: { organizationId: ORG } })
    await employeesHandler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body).toEqual({ error: 'Forbidden' })
    // The route must never touch employee data once membership fails.
    expect((prisma.employee.findMany as any)).not.toHaveBeenCalled()
  })

  it('returns 401 Unauthorized when there is no valid authenticated user', async () => {
    ;(requireUserFromRequest as any).mockResolvedValue(null)
    const { req, res } = makeReqRes({ method: 'GET', query: { organizationId: ORG } })
    await employeesHandler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('allows a genuine member through to see the organization employee list', async () => {
    ;(requireUserFromRequest as any).mockResolvedValue({ id: 'user-member' })
    ;(userHasMembership as any).mockResolvedValue(true)
    ;(prisma.employee.findMany as any).mockResolvedValue([{ id: 'emp1', name: 'Alice' }])

    const { req, res } = makeReqRes({ method: 'GET', query: { organizationId: ORG } })
    await employeesHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual([{ id: 'emp1', name: 'Alice' }])
  })

  it('/api/payroll/my resolves only the caller\'s own Employee record, never a client-supplied employeeId', async () => {
    const employeeA = { id: 'emp-A', organizationId: ORG, userId: 'user-A', name: 'Employee A', ssnEncrypted: 'secret' }
    ;(requireUserFromRequest as any).mockResolvedValue({ id: 'user-A' })
    ;(prisma.employee.findFirst as any).mockImplementation(async ({ where }: any) => {
      // Simulate the real DB: only Employee A is linked to user-A.
      if (where.userId === 'user-A' && where.organizationId === ORG) return employeeA
      return null
    })
    ;(prisma.employeeTaxProfile.findUnique as any).mockResolvedValue(null)
    ;(prisma.directDepositAccount.findMany as any).mockResolvedValue([])

    // Attacker (authenticated as user-A) tries to smuggle in employee B's id as a query param.
    const { req, res } = makeReqRes({ method: 'GET', query: { organizationId: ORG, employeeId: 'emp-B' } })
    await myProfileHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.employee.id).toBe('emp-A')
    // The handler resolved strictly by { organizationId, userId }, ignoring the smuggled employeeId.
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({ where: { organizationId: ORG, userId: 'user-A' } })
    // SSN is never exposed even to the record's own owner via this endpoint.
    expect(res.body.employee.ssnEncrypted).toBeUndefined()
  })

  it('/api/payroll/my/paystubs never returns another employee\'s paystubs', async () => {
    const employeeA = { id: 'emp-A', organizationId: ORG, userId: 'user-A' }
    const paystubsForA = [{ id: 'stub-A1', employeeId: 'emp-A', netPay: '850.00' }]

    ;(requireUserFromRequest as any).mockResolvedValue({ id: 'user-A' })
    ;(prisma.employee.findFirst as any).mockImplementation(async ({ where }: any) => (where.userId === 'user-A' ? employeeA : null))
    ;(prisma.payStub.findMany as any).mockImplementation(async ({ where }: any) => (where.employeeId === 'emp-A' ? paystubsForA : []))

    const { req, res } = makeReqRes({ method: 'GET', query: { organizationId: ORG, employeeId: 'emp-B' } })
    await myPaystubsHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(paystubsForA)
    // Proves isolation: the paystub query was scoped to employee A's own resolved id, not any client input.
    expect(prisma.payStub.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeId: 'emp-A' } }))
  })

  it('404s when the calling user has no linked Employee record in the organization (no cross-employee fallback)', async () => {
    ;(requireUserFromRequest as any).mockResolvedValue({ id: 'user-no-employee' })
    ;(prisma.employee.findFirst as any).mockResolvedValue(null)

    const { req, res } = makeReqRes({ method: 'GET', query: { organizationId: ORG } })
    await myProfileHandler(req, res)

    expect(res.statusCode).toBe(404)
  })
})
