This baseline migration was created to match the current Prisma schema and apply the core database objects.

If you applied `migration.sql` directly in Supabase SQL Editor, mark this migration as applied for Prisma locally (or in an environment that can reach the DB) so Prisma Migrate will not attempt to re-apply it.

To mark as applied (run where you have DB access):

```bash
# replace with your environment or set DATABASE_URL in the shell
npx prisma migrate resolve --applied 0001_init
```

To seed demo data (after the migration is applied):

```bash
# set DATABASE_URL and run seed script
node prisma/seed.js
```

Notes:
- We used `gen_random_uuid()` (pgcrypto). The SQL includes `CREATE EXTENSION IF NOT EXISTS pgcrypto;` which Supabase supports.
- After marking the migration as applied, you can continue using `prisma migrate dev` in environments that can reach the database.
