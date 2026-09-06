import { describe, it, expect, vi } from 'vitest'
import { postJournalEntry, isBalanced } from '../src/lib/ledger'

describe('postJournalEntry behavior (mocked Prisma)', () => {
  it('throws when idempotency key missing', async () => {
    const ctx: any = { prisma: {}, actorId: 'actor' }
    const entry = { organizationId: 'org', lines: [{ accountId: 'a', amount: '10.00', isDebit: true }, { accountId: 'b', amount: '10.00', isDebit: false }] }
    await expect(postJournalEntry(ctx as any, entry as any)).rejects.toThrow()
  })

  it('returns existing entry when idempotency key present', async () => {
    const existing = { id: 'existing-id', idempotencyKey: 'idem-1' }
    const prismaMock: any = {
      journalEntry: { findUnique: vi.fn(async ({ where }: any) => existing), create: vi.fn() },
      auditEvent: { create: vi.fn() },
      $transaction: vi.fn(async (fn: any) => {
        return fn(prismaMock)
      })
    }
    const ctx: any = { prisma: prismaMock, actorId: 'actor' }
    const entry = { organizationId: 'org', idempotencyKey: 'idem-1', lines: [{ accountId: 'a', amount: '5.00', isDebit: true }, { accountId: 'b', amount: '5.00', isDebit: false }] }
    const res = await postJournalEntry(ctx as any, entry as any)
    expect(res).toBe(existing)
    expect(prismaMock.journalEntry.create).not.toHaveBeenCalled()
  })

  it('creates entry when idempotency key not found', async () => {
    const created = { id: 'new-id' }
    const prismaMock: any = {
      journalEntry: { findUnique: vi.fn(async () => null), create: vi.fn(async () => created) },
      auditEvent: { create: vi.fn() },
      $transaction: vi.fn(async (fn: any) => fn(prismaMock))
    }
    const ctx: any = { prisma: prismaMock, actorId: 'actor' }
    const entry = { organizationId: 'org', idempotencyKey: 'idem-2', lines: [{ accountId: 'a', amount: '7.00', isDebit: true }, { accountId: 'b', amount: '7.00', isDebit: false }] }
    const res = await postJournalEntry(ctx as any, entry as any)
    expect(res).toBe(created)
    expect(prismaMock.journalEntry.create).toHaveBeenCalled()
    expect(prismaMock.auditEvent.create).toHaveBeenCalled()
  })

  it('isBalanced works for sample lines', () => {
    const lines = [{ accountId: 'a', amount: '10.00', isDebit: true }, { accountId: 'b', amount: '10.00', isDebit: false }]
    expect(isBalanced(lines as any)).toBe(true)
  })
})
