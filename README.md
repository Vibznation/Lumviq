# Lumviq — Clarity behind every number.

This repository is the starting scaffold for Lumviq, an AI-native accounting and financial platform.

Setup (development):

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Install dependencies: `npm install`.
3. Generate Prisma client: `npx prisma generate`.
4. Run dev server: `npm run dev`.

Applying schema to Supabase
---------------------------
If your environment cannot connect to Supabase (IPv6 routing), apply the baseline SQL directly in Supabase SQL Editor. The baseline migration file is at `prisma/migrations/0001_init/migration.sql`.

To seed demo data (roles, demo org, demo user, sample journal entry) run:

```powershell
# set env for this session (do NOT commit .env)
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.hiqpngvezrhbfusocytb.supabase.co:5432/postgres"
node prisma/seed.js
```

This will insert a demo organization `Lumviq Demo Org` and a demo user `demo@lumviq.test` (password `Password123!` in the seed). Change passwords in production.

Architecture notes:
- Next.js (App Router)
- TypeScript (strict)
- PostgreSQL (Prisma)
- Prisma for schema + migrations
- Vitest for unit tests

Progress: initial scaffold and core ledger validation utilities.
