Param(
  [string]$DatabaseUrl
)

if (-not $DatabaseUrl) {
  if ($env:DATABASE_URL) { $DatabaseUrl = $env:DATABASE_URL } else {
    Write-Host "Set DATABASE_URL env var and re-run. Example:"
    Write-Host '$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.hiqpngvezrhbfusocytb.supabase.co:5432/postgres"'
    exit 1
  }
}

$env:DATABASE_URL = $DatabaseUrl

npx prisma migrate resolve --applied 0003_reconciliation_constraints
