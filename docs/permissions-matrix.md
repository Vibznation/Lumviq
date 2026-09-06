# Permissions matrix

Lumviq's authorization model is intentionally simple today: **organization
membership is the primary gate**. Any authenticated user who is a member
of an organization (`OrganizationMembership`) can read and write nearly
all of that organization's data. A small, explicit set of actions require
an additional named permission on top of membership. This is a deliberate,
honest simplification — not every action listed below is independently
permission-gated yet.

## Roles seeded today
| Role | Notes |
|---|---|
| `owner` | Implicitly has every named permission (`userHasPermission` short-circuits `true` for `role === 'owner'`), in addition to full membership access. |
| `member` | Full membership access to organization data, **except** the named permissions below, which must be explicitly granted via `RolePermission`. |

Custom roles can be created via the `Role`/`Permission`/`RolePermission`
tables, but no UI exists yet to manage them beyond the seed data — see
`prisma/seed.js`.

## Named permissions in use
| Permission | Gates | Enforced in |
|---|---|---|
| `invite_members` | Sending an organization invitation | `src/pages/api/orgs/invite.ts` |
| `bank.reconcile` | Applying a batch of bank-transaction matches / finalizing a reconciliation match | `src/pages/api/banking/reconcile/match.ts`, `apply-batch.ts` |

## Membership-gated (no extra permission) actions
Everything else — creating/editing customers, vendors, invoices, bills,
payments, journal entries, budgets, payroll runs, projects, inventory,
documents, notifications, approvals, dimensions, funds/grants,
contractors, exchange rates, webhooks, imports/exports — only requires
`userHasMembership(user.id, organizationId)` to return true. There is
currently no distinction between, e.g., a bookkeeper role that can only
view reports vs. one that can post journal entries: any member can do
both.

## Approval gate (separate from role permissions)
The `Approval` pending-action pattern (see
[architecture.md](architecture.md)) is a workflow control, not a
role-based permission: **any** member of the organization can approve or
reject a pending approval today via `POST /api/approvals/[id]/decide` —
there is no "approver" role restriction yet. This is a known gap; a
real deployment should restrict approval decisions to owners/admins
before relying on this as a control, and is tracked in
[known-limitations.md](known-limitations.md).

## Tenant isolation
Permission checks are necessary but not sufficient — every query is also
scoped by `organizationId` at the database-query level (see
[architecture.md](architecture.md) and
[security-notes.md](security-notes.md)). A user who is a member of
organization A can never see organization B's data even if they guess
record IDs, because every lookup either filters by `organizationId`
directly or re-derives it from the fetched record before checking
membership.
