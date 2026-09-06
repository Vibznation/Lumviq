# Security notes

## Authentication
- Email/password only; passwords hashed with bcrypt (`bcryptjs`, cost
  factor 10) — see `src/pages/api/auth/register.ts`.
- On successful login, a JWT is issued (`signToken` in `src/lib/auth.ts`)
  and must be sent as `Authorization: Bearer <token>` on every subsequent
  API request. There is **no session cookie**.
- `User.mfaEnabled` / `User.passkeyRegistered` boolean columns exist in
  the schema but there is **no enrollment or verification flow
  implemented yet** — these are schema-ready placeholders for a future
  MFA/passkey feature, not a working control. Do not rely on them.

## CSRF
Classic CSRF (Cross-Site Request Forgery) protection is **not
applicable** to this architecture: CSRF exploits the browser's automatic
inclusion of cookies/credentials on cross-site requests, but Lumviq's API
authenticates via an explicit `Authorization: Bearer` header that a
malicious third-party page cannot automatically attach — a script
on another origin cannot read the token out of this app's storage
(subject to no XSS, see below) and cannot forge the header. No CSRF
token is implemented, and none is needed under this auth model.

## XSS
- React escapes all rendered text by default; the codebase does not use
  `dangerouslySetInnerHTML` anywhere in the new (or existing) UI code.
- The `Content-Security-Policy` header set in `next.config.js` restricts
  `script-src` to `'self'` (no inline scripts, no third-party script
  origins), which provides defense-in-depth even if an XSS injection
  point were later introduced.

## Security headers
`next.config.js` sets, on every response: `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`,
`Strict-Transport-Security` (HSTS), and a `Content-Security-Policy`.

## Rate limiting
- `src/lib/rate-limit.ts` implements a simple in-memory sliding-window
  limiter, applied to `POST /api/auth/login` (10 attempts/minute per IP)
  and `POST /api/auth/register` (5 attempts/minute per IP).
- **Limitation**: this is per-process memory. In a multi-instance /
  serverless deployment, each instance has its own counters, so the
  effective limit is `limit × instance count`. A production deployment
  behind a load balancer should replace this with a shared store (Redis,
  or a platform-level WAF/rate-limit feature) — tracked in
  [known-limitations.md](known-limitations.md).
- Other auth-adjacent endpoints (invite acceptance, password reset if
  added later) are not yet rate-limited.

## Tenant isolation
- Every organization-scoped table carries `organization_id`. Every API
  route checks `userHasMembership(user.id, organizationId)` (or a
  specific permission — see
  [permissions-matrix.md](permissions-matrix.md)) before reading or
  writing, and every Prisma query is filtered by that `organizationId`.
- There is **no database-level row-level security (RLS)** — isolation is
  enforced entirely in the Next.js API layer. A bug in a single route
  handler could theoretically bypass isolation; there is no defense-in-
  depth database policy backing it up today. This is an accepted
  trade-off for development velocity and should be revisited (e.g.
  Postgres RLS policies) before handling regulated/highly sensitive data
  at scale.

## Secrets
- `DATABASE_URL`, JWT signing secret, and any future provider API keys
  are read from environment variables only (see `.env.example`) and are
  excluded from git via `.gitignore`. No secret is hard-coded in source.
- Webhook signing secrets (`src/lib/webhooks.ts`) are generated
  server-side with `crypto.randomBytes` and shown to the user **once**
  at creation time; they are stored in the `Webhook` table in plaintext
  today (not hashed) since the server itself must recompute HMAC
  signatures using the same secret — this is standard practice for
  webhook signing secrets (unlike passwords), but access to the database
  should be restricted accordingly.

## File uploads
- Documents are uploaded as base64-encoded JSON (10MB limit enforced by
  both the API body-size config and application-level size checks) and
  written to a local `uploads/<organizationId>/<uuid>-<sanitizedName>`
  path — see `src/lib/documents.ts`. Filenames are sanitized before use
  in file paths to prevent path traversal.
- **Limitation**: local disk storage does not survive across multiple
  server instances or ephemeral deployments (e.g. most serverless
  platforms). A production deployment should replace this with
  object storage (S3-compatible) — tracked in
  [known-limitations.md](known-limitations.md).
- No malware/virus scanning is performed on uploaded files.

## Dependency posture
No new third-party runtime dependencies were introduced for this
session's features (approvals, documents, notifications, import/export,
webhooks, etc.) — they were built on top of already-vetted dependencies
(`zod`, `papaparse`, `jsonwebtoken`, `bcryptjs`, `uuid`, Node's built-in
`crypto`), keeping the dependency-related attack surface unchanged.
