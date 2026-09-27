import { describe, it, expect, vi } from 'vitest'
import { mileageAmount, buildReimbursementLinesFromMileage, convertMileageLogsToReimbursementTx } from '../src/lib/mileage'

describe('mileage.ts', () => {
  it('computes miles * rate rounded to cents', () => {
    expect(mileageAmount(100, 0.67)).toBe(67)
    expect(mileageAmount(12.3, 0.655)).toBeCloseTo(8.06, 2)
  })

  it('handles zero miles', () => {
    expect(mileageAmount(0, 0.67)).toBe(0)
  })

  it('builds multi-line reimbursement entries from mileage logs', () => {
    const lines = buildReimbursementLinesFromMileage(
      [
        {
          id: 'log-1',
          date: '2026-09-01T00:00:00Z',
          startLocation: 'Office',
          endLocation: 'Client Site',
          purpose: 'Consultation',
          miles: '25.5',
          amount: '17.09',
        },
        {
          id: 'log-2',
          date: '2026-09-02T00:00:00Z',
          startLocation: 'Client Site',
          endLocation: 'Office',
          purpose: null,
          miles: '25.5',
          amount: '17.09',
        },
      ],
      'acc-expense-1'
    )

    expect(lines).toHaveLength(2)
    expect(lines[0].description).toBe('25.5 mi: Office → Client Site (Consultation)')
    expect(lines[0].amount).toBe('17.09')
    expect(lines[0].expenseAccountId).toBe('acc-expense-1')
    expect(lines[1].description).toBe('25.5 mi: Client Site → Office')
  })

  it('converts mileage logs to a pending reimbursement in transaction', async () => {
    const mockLogs = [
      { id: 'log-1', date: new Date('2026-09-01'), startLocation: 'A', endLocation: 'B', purpose: 'Trip 1', miles: 10, amount: 6.7, reimbursementId: null },
      { id: 'log-2', date: new Date('2026-09-02'), startLocation: 'B', endLocation: 'C', purpose: 'Trip 2', miles: 20, amount: 13.4, reimbursementId: null },
    ]

    const tx = {
      mileageLog: {
        findMany: vi.fn().mockResolvedValue(mockLogs),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      reimbursement: {
        create: vi.fn().mockResolvedValue({
          id: 'reimb-101',
          organizationId: 'org-1',
          payeeName: 'Jane Doe',
          amount: '20.10',
          status: 'pending',
          lines: [{ id: 'line-1' }, { id: 'line-2' }],
        }),
      },
      auditEvent: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    }

    const res = await convertMileageLogsToReimbursementTx(tx as any, {
      organizationId: 'org-1',
      actorId: 'user-1',
      payeeName: 'Jane Doe',
      expenseAccountId: 'acc-travel',
      mileageLogIds: ['log-1', 'log-2'],
    })

    expect(res.id).toBe('reimb-101')
    expect(res.amount).toBe('20.10')
    expect(tx.mileageLog.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['log-1', 'log-2'] } },
      data: { reimbursementId: 'reimb-101' },
    })
    expect(tx.auditEvent.create).toHaveBeenCalled()
  })

  it('rejects already-reimbursed logs', async () => {
    const mockLogs = [
      { id: 'log-1', date: new Date(), startLocation: 'A', endLocation: 'B', miles: 10, amount: 6.7, reimbursementId: 'reimb-existing' },
    ]

    const tx = {
      mileageLog: {
        findMany: vi.fn().mockResolvedValue(mockLogs),
      },
    }

    await expect(
      convertMileageLogsToReimbursementTx(tx as any, {
        organizationId: 'org-1',
        actorId: 'user-1',
        payeeName: 'Jane Doe',
        expenseAccountId: 'acc-travel',
        mileageLogIds: ['log-1'],
      })
    ).rejects.toThrow(/already linked to a reimbursement/)
  })
})
