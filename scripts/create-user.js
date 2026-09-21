/**
 * Utility script to create or update a user and organization in the production/local DB.
 *
 * Usage:
 *   node scripts/create-user.js vibznation@gmail.com "YourPassword123!" "Vibz Nation" --apply
 */
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')

function loadEnv() {
  const envFile = process.env.GRANT_ENV_FILE || (fs.existsSync(path.join(__dirname, '..', '.env.local')) ? '.env.local' : '.env')
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

const emailArg = process.argv[2]
const passwordArg = process.argv[3]
const orgNameArg = process.argv[4] && !process.argv[4].startsWith('--') ? process.argv[4] : 'My Organization'
const apply = process.argv.includes('--apply')

async function main() {
  if (!emailArg || !passwordArg || emailArg.startsWith('--')) {
    console.error('Usage: node scripts/create-user.js <email> <password> [orgName] [--apply]')
    process.exit(1)
  }

  const url = process.env.DATABASE_URL
  const prisma = new PrismaClient({ datasources: { db: { url } } })

  try {
    const normalizedEmail = emailArg.trim().toLowerCase()
    const passwordHash = await bcrypt.hash(passwordArg, 10)

    let user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    })

    if (user) {
      console.log(`User ${normalizedEmail} already exists (ID: ${user.id}).`)
      if (apply) {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash },
        })
        console.log(`Updated password for ${normalizedEmail}.`)
      } else {
        console.log(`Dry run: pass --apply to update password.`)
      }
    } else {
      console.log(`Creating new user ${normalizedEmail}...`)
      if (apply) {
        const org = await prisma.organization.create({
          data: {
            name: orgNameArg,
            planId: 'enterprise',
            addOns: ['payroll-complete'],
          },
        })
        user = await prisma.user.create({
          data: {
            email: normalizedEmail,
            name: orgNameArg,
            passwordHash,
            emailVerified: true,
            memberships: {
              create: {
                organizationId: org.id,
                role: 'owner',
              },
            },
          },
        })
        console.log(`Created user ${normalizedEmail} (ID: ${user.id}) with org "${orgNameArg}" (ID: ${org.id}).`)
      } else {
        console.log(`Dry run: pass --apply to create user and org.`)
      }
    }
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
