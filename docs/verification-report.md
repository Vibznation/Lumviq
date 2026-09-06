# Verification report

This report records the actual commands run to verify Lumviq's codebase
at the end of the "Phase 5 expansion" session (Documents, Notifications,
Approvals, Import/Export, Nonprofit funds/grants, Multi-currency,
Dimensions, Contractors, AI interaction logging, Webhooks, Global command
bar, security hardening, and expanded demo data). Re-run these same
commands after any future change before considering it complete.

## 1. Database migrations
```
> npx prisma migrate deploy
10 migrations found in prisma/migrations
Applying migration `0010_approval_payload`
All migrations have been successfully applied.
```
All 10 migrations (`0001_init` through `0010_approval_payload`) apply
cleanly against a local PostgreSQL 14+ database.

## 2. Prisma Client generation
```
> npx prisma generate
✔ Generated Prisma Client (v5.22.0) to .\node_modules\@prisma\client in 329ms
```

## 3. Type checking
```
> npx tsc --noEmit
(no output — zero errors)
```

## 4. Unit tests
```
> npx vitest run
 Test Files  12 passed (12)
      Tests  73 passed (73)
```
Covers: money/minor-unit arithmetic, invoicing, purchasing, inventory,
payroll posting, entitlements, plans, contact-sales validation,
reconciliation matching utilities, and ledger/posting/period logic.

## 5. Production build
```
> npm run build
✔ Compiled successfully
✔ Generating static pages (54/54)
```
54 routes built successfully, including every new page (`/approvals`,
`/data/import-export`, `/settings/{currencies,dimensions,funds,
contractors,webhooks}`) and every new API route (notifications,
approvals, documents, import/export, nonprofit, currency,
dimensions, contractors, webhooks, search).

## 6. Demo seed
```
> node prisma/seed.js
Seeding demo data...
Seed complete: org= ... user= demo@lumviq.test journalEntries: ...
Additional demo data added
Bank account and transactions seeded
Demo customers, vendors, invoices and bills seeded
Dimensions, fund/grant, contractor and exchange rate seeded
```
Runs idempotently (safe to re-run) against a local database.

## What this verification does **not** cover
- No browser/e2e test suite exists, so UI interactions (approval
  decisions, command bar search, notification bell, document
  upload/download, import dry-run/commit) were verified by code review
  and manual reasoning about the API contracts, not by automated
  end-to-end tests. This is a gap — see
  [known-limitations.md](known-limitations.md).
- No dedicated unit tests were added for the nine new domain modules
  (notifications, approvals, documents, currency, dimensions,
  contractors, nonprofit, import-export, webhooks) — they are covered
  only by `tsc --noEmit` and the production build succeeding, plus the
  existing test suite continuing to pass. Adding targeted unit tests for
  these modules (especially `approvals.ts`'s pending-action executor and
  `import-export.ts`'s validation/commit logic) is recommended before
  relying on them in production.
- Load/performance testing was not performed.
