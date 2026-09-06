import { describe, it, expect } from "vitest";
import { isBalanced, validateJournalEntry } from "../src/lib/ledger";

const balancedLines = [
  { accountId: "11111111-1111-1111-1111-111111111111", amount: "100.00", isDebit: true },
  { accountId: "22222222-2222-2222-2222-222222222222", amount: "100.00", isDebit: false },
];

const unbalancedLines = [
  { accountId: "11111111-1111-1111-1111-111111111111", amount: "100.00", isDebit: true },
  { accountId: "22222222-2222-2222-2222-222222222222", amount: "90.00", isDebit: false },
];

describe("Ledger validation", () => {
  it("detects a balanced journal", () => {
    expect(isBalanced(balancedLines as any)).toBe(true);
  });
  it("detects an unbalanced journal", () => {
    expect(isBalanced(unbalancedLines as any)).toBe(false);
  });
  it("validateJournalEntry throws for unbalanced entries", () => {
    expect(() => validateJournalEntry({ organizationId: "33333333-3333-3333-3333-333333333333", lines: unbalancedLines })).toThrow();
  });
});
