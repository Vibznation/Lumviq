/**
 * One-off script: grants the Payroll add-on to every organization that
 * vibztv@gmail.com is a member of, per explicit product request. Safe to
 * re-run (idempotent — only appends the add-on id if it's not already
 * present). Does not touch any other user or organization.
 *
 * Usage:
 *   node scripts/grant-payroll-addon.js            # dry run (no writes)
 *   node scripts/grant-payroll-addon.js --apply     # actually writes
 *
 * Which add-on tier is granted is controlled by PAYROLL_ADDON_ID
 * (defaults to 'payroll-complete', the mid tier) — see src/lib/plans.ts
 * for the full list ('payroll-start' | 'payroll-complete' | 'payroll-complete-hr').
 */
const fs = require('fs')
const path = require('path')

// Plain node scripts don't get Next.js's automatic .env.local loading, and
// this project keeps DATABASE_URL there (not committed) rather than in a
// root .env consumed by the Prisma CLI. Load it manually, without adding a
// new dependency, before requiring @prisma/client.
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', process.env.GRANT_ENV_FILE || '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    // `vercel env pull` sometimes stores a literal trailing "\r\n"/"\n"/"\r"
    // escape sequence inside the quoted value (from a value that was
    // originally pasted/added with a trailing newline) rather than an
    // actual line break. Strip that artifact so the URL parses correctly.
    value = value.replace(/\\r\\n$|\\n$|\\r$/, '')
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnvLocal()

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const EMAIL = 'vibztv@gmail.com'
const ADDON_ID = process.env.PAYROLL_ADDON_ID || 'payroll-complete'
const APPLY = process.argv.includes('--apply')

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    include: { memberships: { include: { organization: true } } },
  })

  if (!user) {
    console.log(`No user found with email ${EMAIL}. Nothing to do.`)
    return
  }

  if (user.memberships.length === 0) {
    console.log(`User ${EMAIL} (${user.id}) has no organization memberships. Nothing to do.`)
    return
  }

  console.log(`User ${EMAIL} (${user.id}) belongs to ${user.memberships.length} organization(s):`)
  for (const m of user.memberships) {
    const org = m.organization
    const already = org.addOns.includes(ADDON_ID)
    console.log(`  - ${org.name} (${org.id}) — current addOns: [${org.addOns.join(', ')}]${already ? '  [already has payroll]' : ''}`)
  }

  if (!APPLY) {
    console.log('\nDry run only — no changes made. Re-run with --apply to grant the add-on.')
    return
  }

  for (const m of user.memberships) {
    const org = m.organization
    if (org.addOns.includes(ADDON_ID)) continue
    await prisma.organization.update({
      where: { id: org.id },
      data: { addOns: { push: ADDON_ID } },
    })
    console.log(`Granted '${ADDON_ID}' to organization ${org.name} (${org.id}).`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
