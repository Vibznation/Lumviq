import { describe, it, expect, vi } from 'vitest'
import { closeAccountingPeriod } from '../src/lib/accounting-periods'

function makeTx(overrides: Partial<Record<string, any>> = {}) {
  return {
    accountingPeriod: {
      findUnique: vi.fn(async () => ({ id: 'p1', isClosed: false, fiscalYear: { organizationId: 'org1' } })),
      update: vi.fn(async ({ data }: any) => ({ id: 'p1', isClosed: data.isClosed })),
    },
    closeChecklistItem: {
      count: vi.fn(async () => 0),
    },
    auditEvent: { create: vi.fn(async () => ({})) },
    ...overrides,
  }
}

describe('closeAccountingPeriod', () => {
  it('rejects closing when no checklist has been created', async () => {
    const tx = makeTx()
    await expect(closeAccountingPeriod(tx, { accountingPeriodId: 'p1', actorId: 'u1' })).rejects.toThrow(
      'Create a close checklist for this period before closing it'
    )
  })

  it('rejects closing when checklist items are incomplete', async () => {
    const tx = makeTx({
      closeChecklistItem: {
        count: vi.fn(async ({ where }: any) => (where.status ? 1 : 3)),
      },
    })
    await expect(closeAccountingPeriod(tx, { accountingPeriodId: 'p1', actorId: 'u1' })).rejects.toThrow(
      'All close checklist items must be complete before closing the period'
    )
  })

  it('rejects closing an already-closed period', async () => {
    const tx = makeTx({
      accountingPeriod: {
        findUnique: vi.fn(async () => ({ id: 'p1', isClosed: true, fiscalYear: { organizationId: 'org1' } })),
        update: vi.fn(),
      },
    })
    await expect(closeAccountingPeriod(tx, { accountingPeriodId: 'p1', actorId: 'u1' })).rejects.toThrow(
      'Accounting period is already closed'
    )
  })

  it('closes the period and writes an audit event once the checklist is fully complete', async () => {
    const tx = makeTx({
      closeChecklistItem: {
        count: vi.fn(async ({ where }: any) => (where.status ? 0 : 3)),
      },
    })
    const result = await closeAccountingPeriod(tx, { accountingPeriodId: 'p1', actorId: 'u1' })
    expect(result.isClosed).toBe(true)
    expect(tx.accountingPeriod.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isClosed: true } })
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org1',
          actorId: 'u1',
          action: 'close_accounting_period',
          resourceType: 'accounting_period',
          resourceId: 'p1',
        }),
      })
    )
  })
})
