#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Set DATABASE_URL and re-run. Example:"
  echo "export DATABASE_URL='postgresql://postgres:YOUR_PASSWORD@db.hiqpngvezrhbfusocytb.supabase.co:5432/postgres'"
  exit 1
fi

npx prisma migrate resolve --applied 0003_reconciliation_constraints
