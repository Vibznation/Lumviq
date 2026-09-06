# Deployment instructions

These instructions cover deploying Lumviq's Next.js app and PostgreSQL
database. Lumviq has no infrastructure-as-code / CI-CD pipeline checked
into this repository yet — this document describes the manual steps to
stand up an environment.

## Prerequisites
- Node.js 18+ and npm.
- A PostgreSQL 14+ database reachable from the app server (local, a
  managed provider such as Supabase/RDS/Cloud SQL, or self-hosted).

## 1. Configure environment variables
Copy `.env.example` to `.env` (or `.env.local` for local development) and
set at minimum:
- `DATABASE_URL` — PostgreSQL connection string.
- `JWT_SECRET` — a long random string used to sign auth tokens (see
  `src/lib/auth.ts`).
- `NEXT_PUBLIC_APP_NAME` — optional, overrides the displayed brand name.

Never commit `.env` or `.env.local` — both are excluded via `.gitignore`.

## 2. Install dependencies
```bash
npm install
```

## 3. Apply database migrations
**Do not run `npx prisma migrate dev`** in this repository (see
[PRISMA_MIGRATE.md](PRISMA_MIGRATE.md) for why). Instead:
```bash
npx prisma migrate deploy
npx prisma generate
```
This applies every migration under `prisma/migrations/` in order and
regenerates the Prisma Client.

## 4. Seed demo data (optional, non-production)
```bash
node prisma/seed.js
```
Creates a demo organization, demo user (`demo@lumviq.test` /
`Password123!`), roles/permissions, and sample records. **Do not run
against a production database** — change or remove the demo account
first if you do.

## 5. Verify before deploying
```bash
npx tsc --noEmit
npx vitest run
npm run build
```
All three must succeed — see [verification-report.md](verification-report.md)
for the last recorded run of these commands.

## 6. Run
- Development: `npm run dev` (starts on port 3000 by default).
- Production: `npm run build` then `npm run start`, or deploy the built
  `.next` output to a Next.js-compatible host (Vercel, a Node server
  behind a reverse proxy, a container platform, etc.).

## File storage caveat
Uploaded documents (`src/lib/documents.ts`) are written to a local
`uploads/` directory relative to the process's working directory. On any
platform where the filesystem is ephemeral or where multiple instances
run concurrently (most serverless/PaaS platforms, container
autoscaling), uploaded files will not persist or will not be visible
across instances. Before deploying to such a platform, replace local
disk storage with object storage (e.g. S3-compatible) — see
[security-notes.md](security-notes.md) and
[known-limitations.md](known-limitations.md).

## Reverse proxy / TLS
This app does not terminate TLS itself. Run it behind a reverse proxy or
platform load balancer that terminates HTTPS, and ensure
`X-Forwarded-For` is set correctly so `src/lib/rate-limit.ts`'s
`clientIp()` reads real client IPs rather than the proxy's IP.

## Environment separation
Use separate databases (and separate `JWT_SECRET` values) for
development, staging and production. There is no multi-environment
config system beyond standard `.env` files today.
