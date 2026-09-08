import { z } from "zod";

export const JournalLineSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().optional(),
  amount: z.string(), // amounts must be sent as string to preserve precision (minor units or decimal string)
  isDebit: z.boolean(),
});

export const JournalEntrySchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  description: z.string().optional(),
  idempotencyKey: z.string().optional(),
  lines: z.array(JournalLineSchema).min(1),
  posted: z.boolean().optional(),
});

export type JournalLine = z.infer<typeof JournalLineSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

// Use BigInt-like decimal arithmetic via string sums to avoid floating point issues.
function sumAmounts(lines: JournalLine[]): { debit: bigint; credit: bigint } {
  // Expect amounts as decimal strings with up to 6 decimals (per prisma schema); normalize to integer minor units (6 decimals)
  const scale = BigInt(1_000_000);
  let debit = BigInt(0);
  let credit = BigInt(0);
  for (const l of lines) {
    const parts = l.amount.split(".");
    const whole = BigInt(parts[0] || "0");
    const frac = (parts[1] || "").padEnd(6, "0").slice(0, 6);
    const scaled = whole * scale + BigInt(frac);
    if (l.isDebit) debit += scaled;
    else credit += scaled;
  }
  return { debit, credit };
}

export function isBalanced(lines: JournalLine[]): boolean {
  const { debit, credit } = sumAmounts(lines);
  return debit === credit;
}

export function validateJournalEntry(raw: unknown) {
  const parsed = JournalEntrySchema.parse(raw);
  if (!isBalanced(parsed.lines)) throw new Error("Journal entry is not balanced");
  return parsed as JournalEntry;
}

/** Sum of the debit side of a balanced journal entry, as a plain decimal number (for approval-threshold comparisons only — never use this for ledger posting math). */
export function journalEntryDebitTotal(lines: JournalLine[]): number {
  const { debit } = sumAmounts(lines);
  return Number(debit) / 1_000_000;
}

/**
 * Posts a journal entry using an already-open Prisma transaction client.
 * Shared by the direct posting API route (wrapped in its own
 * prisma.$transaction) and the approvals executor (see
 * src/lib/approvals.ts), which already runs inside a transaction and
 * cannot open a nested one.
 */
export async function postJournalEntryTx(tx: any, entry: JournalEntry, actorId: string) {
  if (!isBalanced(entry.lines)) throw new Error("Journal entry is not balanced");
  if (!entry.idempotencyKey) throw new Error("Idempotency key required for posting");

  const postedAt = new Date()
  const period = await tx.accountingPeriod.findFirst({
    where: {
      fiscalYear: { organizationId: entry.organizationId },
      startDate: { lte: postedAt },
      endDate: { gte: postedAt },
    },
  })
  if (period && period.isClosed) throw new Error('Accounting period is closed for the posting date')

  const existing = await tx.journalEntry.findUnique({ where: { idempotencyKey: entry.idempotencyKey } });
  if (existing) return existing;
  const created = await tx.journalEntry.create({
    data: {
      id: entry.id,
      organizationId: entry.organizationId,
      description: entry.description,
      posted: true,
      postedAt,
      idempotencyKey: entry.idempotencyKey,
      lines: { create: entry.lines.map((l) => ({ accountId: l.accountId, amount: l.amount, isDebit: l.isDebit, description: l.description })) },
    },
    include: { lines: true },
  });
  await tx.auditEvent.create({ data: { organizationId: entry.organizationId, actorId, action: "post_journal_entry", resourceType: "journal_entry", resourceId: created.id, newState: {} } });
  return created;
}

// Placeholder for posting logic: must be transactional and idempotent when integrated with DB.
export async function postJournalEntry(
  ctx: { prisma: any; actorId: string },
  entry: JournalEntry
) {
  // This function expects a Prisma client in ctx.prisma. It validates balance, checks idempotency and posts the entry.
  if (!isBalanced(entry.lines)) throw new Error("Journal entry is not balanced");
  if (!entry.idempotencyKey) throw new Error("Idempotency key required for posting");

  // The actual implementation must run inside a DB transaction and enforce posted immutability.
  return await ctx.prisma.$transaction(async (tx: any) => postJournalEntryTx(tx, entry, ctx.actorId));
}
