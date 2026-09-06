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

// Placeholder for posting logic: must be transactional and idempotent when integrated with DB.
export async function postJournalEntry(
  ctx: { prisma: any; actorId: string },
  entry: JournalEntry
) {
  // This function expects a Prisma client in ctx.prisma. It validates balance, checks idempotency and posts the entry.
  if (!isBalanced(entry.lines)) throw new Error("Journal entry is not balanced");
  if (!entry.idempotencyKey) throw new Error("Idempotency key required for posting");

  // Check for closed accounting period if postedAt provided
  const postedAt = entry.posted ? new Date() : null
  if (postedAt) {
    const period = await ctx.prisma.accountingPeriod.findFirst({
      where: {
        fiscalYear: { organizationId: entry.organizationId },
        startDate: { lte: postedAt },
        endDate: { gte: postedAt },
      },
    })
    if (period && period.isClosed) throw new Error('Accounting period is closed for the posting date')
  }

  // The actual implementation must run inside a DB transaction and enforce posted immutability.
  return await ctx.prisma.$transaction(async (prisma: any) => {
    const existing = await prisma.journalEntry.findUnique({ where: { idempotencyKey: entry.idempotencyKey } });
    if (existing) return existing;
    const created = await prisma.journalEntry.create({
      data: {
        id: entry.id,
        organizationId: entry.organizationId,
        description: entry.description,
        posted: true,
        postedAt: new Date(),
        idempotencyKey: entry.idempotencyKey,
        lines: { create: entry.lines.map((l) => ({ accountId: l.accountId, amount: l.amount, isDebit: l.isDebit, description: l.description })) },
      },
      include: { lines: true },
    });
    // Append an audit event (simplified)
    await prisma.auditEvent.create({ data: { organizationId: entry.organizationId, actorId: ctx.actorId, action: "post_journal_entry", resourceType: "journal_entry", resourceId: created.id, newState: {} } });
    return created;
  });
}
