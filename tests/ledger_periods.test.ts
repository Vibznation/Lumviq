import { describe, it, expect, vi } from 'vitest'
import { postJournalEntry } from '../src/lib/ledger'

describe('posting rules - closed periods', () => {
  it('rejects posting into a closed period', async () => {
    const prismaMock: any = {
      accountingPeriod: { findFirst: vi.fn(async () => ({ id: 'p1', isClosed: true })) },
      journalEntry: { findUnique: vi.fn(async () => null), create: vi.fn() },
      auditEvent: { create: vi.fn() },
      $transaction: vi.fn(async (fn: any) => fn(prismaMock))
    }
    const ctx: any = { prisma: prismaMock, actorId: 'actor' }
    const entry: any = { organizationId: 'org', idempotencyKey: 'idem-closed', lines: [{ accountId: 'a', amount: '10.00', isDebit: true }, { accountId: 'b', amount: '10.00', isDebit: false }], posted: true }
    await expect(postJournalEntry(ctx, entry)).rejects.toThrow('Accounting period is closed')
  })
})
