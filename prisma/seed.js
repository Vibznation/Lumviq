const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding demo data...')

  // Roles
  const ownerRole = await prisma.role.upsert({ where: { name: 'owner' }, update: {}, create: { name: 'owner', description: 'Organization owner' } })
  const memberRole = await prisma.role.upsert({ where: { name: 'member' }, update: {}, create: { name: 'member', description: 'Standard member' } })

  // Permissions
  const invitePerm = await prisma.permission.upsert({ where: { name: 'invite_members' }, update: {}, create: { name: 'invite_members', description: 'Can invite members' } })
  await prisma.rolePermission.upsert({ where: { id: `${ownerRole.id}-${invitePerm.id}` }, update: {}, create: { roleId: ownerRole.id, permissionId: invitePerm.id } }).catch(()=>{})

  // Demo organization
  const org = await prisma.organization.create({ data: { name: 'Lumviq Demo Org' } })

  // Demo user
  const passwordHash = await bcrypt.hash('Password123!', 10)
  const user = await prisma.user.upsert({ where: { email: 'demo@lumviq.test' }, update: {}, create: { email: 'demo@lumviq.test', name: 'Demo User', passwordHash } })

  // Membership
  await prisma.organizationMembership.create({ data: { userId: user.id, organizationId: org.id, role: 'owner', roleId: ownerRole.id } })

  // Chart of accounts (simple)
  const cash = await prisma.account.create({ data: { organizationId: org.id, code: '1000', name: 'Cash', type: 'asset' } })
  const ar = await prisma.account.create({ data: { organizationId: org.id, code: '1100', name: 'Accounts Receivable', type: 'asset' } })
  const revenue = await prisma.account.create({ data: { organizationId: org.id, code: '4000', name: 'Sales Revenue', type: 'income' } })

  // Create a balanced journal entry: receive payment for invoice
  const je = await prisma.journalEntry.create({
    data: {
      organizationId: org.id,
      description: 'Demo sale received',
      posted: true,
      postedAt: new Date(),
      postingUserId: user.id,
      idempotencyKey: `seed-${Date.now()}`,
      lines: {
        create: [
          { accountId: cash.id, amount: '100.00', isDebit: true, description: 'Cash receipt' },
          { accountId: revenue.id, amount: '100.00', isDebit: false, description: 'Sales revenue' },
        ],
      },
    },
    include: { lines: true },
  })

  // Create an invoice journal entry (AR -> Revenue)
  const invoiceJe = await prisma.journalEntry.create({
    data: {
      organizationId: org.id,
      description: 'Invoice #1001 posted',
      posted: true,
      postedAt: new Date(),
      postingUserId: user.id,
      idempotencyKey: `seed-invoice-${Date.now()}`,
      lines: {
        create: [
          { accountId: ar.id, amount: '250.00', isDebit: true, description: 'Accounts receivable' },
          { accountId: revenue.id, amount: '250.00', isDebit: false, description: 'Sales revenue' },
        ],
      },
    },
    include: { lines: true },
  })

  // Create a vendor bill (Expense -> Accounts Payable) and payment
  const expense = await prisma.account.create({ data: { organizationId: org.id, code: '5000', name: 'Expenses', type: 'expense' } })
  const ap = await prisma.account.create({ data: { organizationId: org.id, code: '2000', name: 'Accounts Payable', type: 'liability' } })

  const billJe = await prisma.journalEntry.create({
    data: {
      organizationId: org.id,
      description: 'Vendor bill #B-100',
      posted: true,
      postedAt: new Date(),
      postingUserId: user.id,
      idempotencyKey: `seed-bill-${Date.now()}`,
      lines: {
        create: [
          { accountId: expense.id, amount: '80.00', isDebit: true, description: 'Office supplies' },
          { accountId: ap.id, amount: '80.00', isDebit: false, description: 'Accounts payable' },
        ],
      },
    },
    include: { lines: true },
  })

  console.log('Seed complete: org=', org.id, ' user=', user.email, 'journalEntries:', je.id, invoiceJe.id, billJe.id)
}

// Add more demo transactions: multiple invoices, payments and bank imports
async function moreDemo(orgId, userId, arAccountId, cashAccountId, revenueAccountId, apAccountId, expenseAccountId) {
  // Generate a few invoices
  for (let i = 0; i < 3; i++) {
    await prisma.journalEntry.create({
      data: {
        organizationId: orgId,
        description: `Invoice #${1002 + i}`,
        posted: true,
        postedAt: new Date(),
        postingUserId: userId,
        idempotencyKey: `seed-invoice-${i}-${Date.now()}`,
        lines: { create: [
          { accountId: arAccountId, amount: `${150 + i * 50}.00`, isDebit: true, description: 'Accounts receivable' },
          { accountId: revenueAccountId, amount: `${150 + i * 50}.00`, isDebit: false, description: 'Sales revenue' },
        ] }
      }
    })
  }

  // Simulate payments for some invoices (cash -> AR)
  await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      description: 'Customer payments batch',
      posted: true,
      postedAt: new Date(),
      postingUserId: userId,
      idempotencyKey: `seed-payments-${Date.now()}`,
      lines: { create: [
        { accountId: cashAccountId, amount: '200.00', isDebit: true, description: 'Cash received' },
        { accountId: arAccountId, amount: '200.00', isDebit: false, description: 'Reduce AR' },
      ] }
    }
  })

  // Simulate bank import (cash movement) as an unreconciled deposit
  await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      description: 'Bank import: deposit',
      posted: true,
      postedAt: new Date(),
      postingUserId: userId,
      idempotencyKey: `seed-bankimport-${Date.now()}`,
      lines: { create: [
        { accountId: cashAccountId, amount: '500.00', isDebit: true, description: 'Bank deposit' },
        { accountId: revenueAccountId, amount: '500.00', isDebit: false, description: 'Unrecognized income' },
      ] }
    }
  })

  // Simulate vendor payments (AP -> cash)
  await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      description: 'Vendor payments',
      posted: true,
      postedAt: new Date(),
      postingUserId: userId,
      idempotencyKey: `seed-vendor-pay-${Date.now()}`,
      lines: { create: [
        { accountId: apAccountId, amount: '80.00', isDebit: true, description: 'Reduce AP' },
        { accountId: cashAccountId, amount: '80.00', isDebit: false, description: 'Cash paid' },
      ] }
    }
  })
}

main()
  .then(async () => {
    // Connect to created demo entities to add more
    const org = await prisma.organization.findFirst({ where: { name: 'Lumviq Demo Org' } })
    const user = await prisma.user.findUnique({ where: { email: 'demo@lumviq.test' } })
    const accounts = await prisma.account.findMany({ where: { organizationId: org.id } })
    const map = {}
    for (const a of accounts) map[a.name] = a.id
    await moreDemo(org.id, user.id, map['Accounts Receivable'], map['Cash'], map['Sales Revenue'], map['Accounts Payable'], map['Expenses'])
    console.log('Additional demo data added')
    // Create bank account and sample bank transactions for reconciliation
    const bank = await prisma.bankAccount.create({ data: { organizationId: org.id, provider: 'csv', name: 'Demo Bank Account', accountNumber: '****1234', currency: 'USD' } })
    await prisma.bankTransaction.createMany({ data: [
      { bankAccountId: bank.id, transactionDate: new Date(), amount: 300.00, description: 'Payment from Acme', externalId: 'ext-1' },
      { bankAccountId: bank.id, transactionDate: new Date(), amount: -80.00, description: 'Payment to Vendor', externalId: 'ext-2' },
      { bankAccountId: bank.id, transactionDate: new Date(), amount: 500.00, description: 'Deposit', externalId: 'ext-3' },
    ] })
    console.log('Bank account and transactions seeded')
  })
  .catch((e) => {
    console.error('Seed error', e)
  })

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
