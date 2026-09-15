/**
 * Utility script to reset a user's password in the database.
 *
 * Usage:
 *   node scripts/reset-password.js vibztv@gmail.com "NewPassword123!"          # dry run
 *   node scripts/reset-password.js vibztv@gmail.com "NewPassword123!" --apply  # update password
 */
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')

function loadEnv() {
  const envFile = process.env.GRANT_ENV_FILE || (fs.existsSync(path.join(__dirname, '..', '.env.inspect-temp')) ? '.env.inspect-temp' : '.env.local')
  const envPath = path.join(__dirname, '..', envFile)
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
    value = value.replace(/\\r\\n$|\\n$|\\r$/, '')
    if (!(key in process.env)) process.env[key] = value
  }
}
loadEnv()

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const emailArg = process.argv[2]
const passwordArg = process.argv[3]
const apply = process.argv.includes('--apply')

async function main() {
  if (!emailArg || !passwordArg || emailArg.startsWith('--')) {
    console.error('Usage: node scripts/reset-password.js <email> <newPassword> [--apply]')
    process.exit(1)
  }

  const normalizedEmail = emailArg.trim().toLowerCase()
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
  })

  if (!user) {
    console.error(`User with email "${emailArg}" not found in database.`)
    process.exit(1)
  }

  console.log(`Found user: ${user.name || 'No name'} (${user.email}, id: ${user.id})`)

  if (!apply) {
    console.log('\n[Dry run] To apply this password change, run with --apply')
    return
  }

  const passwordHash = await bcrypt.hash(passwordArg, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  console.log(`Successfully updated password for ${user.email}.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
