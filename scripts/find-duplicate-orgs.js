// Read-only diagnostic: identify organizations that share the same name and
// have at least one overlapping member (a strong signal of accidental
// duplicate-creation, e.g. from a double-submitted onboarding form before the
// idempotency-key fix). Does NOT modify or delete anything. For manual review.
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, createdAt: true, memberships: { select: { userId: true, role: true } } },
    orderBy: { name: 'asc' },
  })

  const byName = new Map()
  for (const o of orgs) {
    const key = o.name.trim().toLowerCase()
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key).push(o)
  }

  let found = 0
  for (const [name, group] of byName) {
    if (group.length < 2) continue
    // Only flag as a likely duplicate if at least one user is a member of more than one org in the group.
    const userCounts = new Map()
    for (const o of group) {
      for (const m of o.memberships) {
        userCounts.set(m.userId, (userCounts.get(m.userId) || 0) + 1)
      }
    }
    const overlapping = [...userCounts.values()].some((c) => c > 1)
    if (!overlapping) continue
    found++
    console.log(`\nPossible duplicate group: "${name}"`)
    for (const o of group) {
      console.log(`  - id=${o.id} createdAt=${o.createdAt.toISOString()} members=${o.memberships.length}`)
    }
  }

  if (found === 0) console.log('No duplicate-organization groups detected (same name + overlapping member).')
  else console.log(`\n${found} possible duplicate group(s) found. Review manually — no records were modified.`)
}

main().finally(() => prisma.$disconnect())
