Apply these steps to add a DB-level uniqueness constraint preventing multiple reconciliation items for the same bank transaction.

1) Inspect for duplicates

Run in Supabase SQL editor (or psql):

```
SELECT bank_transaction_id, count(*) as cnt
FROM reconciliation_items
GROUP BY bank_transaction_id
HAVING count(*) > 1;
```

If duplicates are reported, decide which rows to keep. A safe cleanup keeps the first row per bank_transaction_id:

```
WITH duplicates AS (
  SELECT id, bank_transaction_id, ROW_NUMBER() OVER (PARTITION BY bank_transaction_id ORDER BY id) as rn
  FROM reconciliation_items
)
DELETE FROM reconciliation_items WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
```

2) Apply the constraint

Paste and run the SQL in `migration.sql` (the `ALTER TABLE ... ADD CONSTRAINT` statement) in the Supabase SQL Editor.

3) Mark migration applied for Prisma

On a machine that can reach the DB (or from a cloud shell with IPv6 if your Supabase host resolves to IPv6), run:

```
npx prisma migrate resolve --applied 0003_reconciliation_constraints
```

Notes
- This migration is safe only after deduplicating existing rows.
- If you prefer, I can produce a reversible migration that records the deletion in a backup table before cleanup.
