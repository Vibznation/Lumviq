Prisma migration resolve — guidance

Goal
- Mark the `0003_reconciliation_constraints` migration as applied in Prisma so the local migration history matches the DB.

Options
1) Recommended: run from an IPv6-capable shell (GitHub Codespaces / GCP Cloud Shell / Azure Cloud Shell / AWS CloudShell / VM)

Bash (example)

export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.hiqpngvezrhbfusocytb.supabase.co:5432/postgres"
./scripts/resolve_migration.sh

PowerShell (example)

$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.hiqpngvezrhbfusocytb.supabase.co:5432/postgres"
./scripts/resolve_migration.ps1

Notes
- If you already ran the ALTER TABLE in the Supabase SQL Editor, the DB constraint is enforced; running `prisma migrate resolve` only updates Prisma's `_prisma_migrations` table/metadata in your environment.
- If your local machine cannot reach the Supabase DB due to IPv6-only AAAA records, open the repo in GitHub Codespaces (recommended) or use Cloud Shell and run the commands above.
- Verify the migration is recorded by checking `_prisma_migrations` or using:

SELECT id, migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;

## Codespaces (recommended)

- Open the repository in GitHub Codespaces.
- In the Codespaces terminal run (bash):

```bash
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.hiqpngvezrhbfusocytb.supabase.co:5432/postgres"
./scripts/resolve_migration.sh
```

- Or PowerShell in Codespaces:

```powershell
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.hiqpngvezrhbfusocytb.supabase.co:5432/postgres"
./scripts/resolve_migration.ps1
```

## Cloud Shell (GCP / Azure / AWS)

- All cloud shells provide outgoing IPv6-capable networking; open your provider's shell and run the same commands as above.

GCP Cloud Shell (example):

```bash
# paste into GCP Cloud Shell
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.hiqpngvezrhbfusocytb.supabase.co:5432/postgres"
./scripts/resolve_migration.sh
```

Azure Cloud Shell (example):

```bash
# paste into Azure Cloud Shell
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.hiqpngvezrhbfusocytb.supabase.co:5432/postgres"
./scripts/resolve_migration.sh
```

AWS CloudShell (example):

```bash
# paste into AWS CloudShell
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.hiqpngvezrhbfusocytb.supabase.co:5432/postgres"
./scripts/resolve_migration.sh
```

## GitHub Actions runner

Use the workflow `.github/workflows/prisma-migrate-resolve.yml` to run `prisma migrate resolve` on a cloud runner.

1) Add repository secret
- Name: `SUPABASE_DATABASE_URL`
- Value: `postgresql://postgres:YOUR_PASSWORD@db.hiqpngvezrhbfusocytb.supabase.co:5432/postgres`

2) Run workflow
- Open GitHub repository -> Actions -> "Prisma Migrate Resolve" -> Run workflow.
- Input `migration_name` (default: `0003_reconciliation_constraints`).

3) Verify
- Check the workflow logs for successful `Mark migration as applied`.
- Optional SQL check:

```sql
SELECT id, migration_name, finished_at
FROM _prisma_migrations
ORDER BY finished_at DESC
LIMIT 5;
```
