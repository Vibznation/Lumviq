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
- Next.js 14 (Pages Router)
- TypeScript (strict)
- PostgreSQL (Prisma)
- Prisma for schema + migrations — **never run `npx prisma migrate dev`** in this repo; see [docs/PRISMA_MIGRATE.md](docs/PRISMA_MIGRATE.md).
- Vitest for unit tests (`npx vitest run`), Playwright for e2e

## What's built

Lumviq's core double-entry ledger, plus these modules built on top of it:

- **Auth & organizations** — email/password auth, multi-org membership, invitations, roles.
- **Chart of accounts & general ledger** — accounts, journal entries/lines, fiscal years, accounting periods.
- **Banking** — CSV import, transaction matching, reconciliation sessions.
- **Sales / Invoicing (AR)** — customers, invoices, tax rates, projects, payments, void/reversal.
- **Purchasing / Bills (AP)** — vendors, bills, tax rates, payments, void/reversal.
- **Inventory** — products (service/non-inventory/inventory), average-cost stock movements, manual adjustments, low-stock indicator.
- **Projects & time tracking** — projects, time entries, billable-value and budget-usage view.
- **Budgeting & planning** — per-account monthly budgets, budget-vs-actual report.
- **Multi-entity management** — link organizations in a parent/child hierarchy for **side-by-side** reporting; ledgers are never merged.
- **Payroll (accounting impact only)** — employees, pay runs, ledger posting for gross pay/liabilities. See [Known limitations](docs/known-limitations.md).
- **Reports** — trial balance, P&L, balance sheet, AR/AP aging, tax summary, budget vs actual, inventory valuation.
- **Intelligence** — deterministic, rule-based insights (cash forecast, overdue receivables, unusual-transaction detection, category frequency). Not an LLM; see [docs/known-limitations.md](docs/known-limitations.md).
- **Integrations** — interfaces only for bank feeds/payments/OCR (`src/lib/integrations/`); UI always shows "Not connected" until a real provider is wired in.

See [docs/roadmap.md](docs/roadmap.md) for what's planned next and [docs/known-limitations.md](docs/known-limitations.md) for explicit scope boundaries.

Progress: core ledger plus Sales, Purchasing, Inventory, Projects, Budgeting, Multi-entity, Payroll, Intelligence and Reports modules implemented and verified (`tsc --noEmit`, `vitest run`, `next build` all pass).
