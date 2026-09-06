const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding demo data...')

  // Roles
  const ownerRole = await prisma.role.upsert({
    where: { name: 'owner' },
    update: {},
    create: { name: 'owner', description: 'Organization owner' },
  })
  const memberRole = await prisma.role.upsert({
    where: { name: 'member' },
    update: {},
    create: { name: 'member', description: 'Standard member' },
  })

  // Permissions
  const invitePerm = await prisma.permission.upsert({
    where: { name: 'invite_members' },
    update: {},
    create: { name: 'invite_members', description: 'Can invite members' },
  })
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: ownerRole.id,
        permissionId: invitePerm.id,
      },
    },
    update: {},
    create: { roleId: ownerRole.id, permissionId: invitePerm.id },
  })

  // Demo organization
  let org = await prisma.organization.findFirst({ where: { name: 'Lumviq Demo Org' } })
  if (!org) {
    org = await prisma.organization.create({ data: { name: 'Lumviq Demo Org' } })
  }

  // Demo user
  const passwordHash = await bcrypt.hash('Password123!', 10)
  const user = await prisma.user.upsert({
    where: { email: 'demo@lumviq.test' },
    update: { name: 'Demo User', passwordHash },
    create: { email: 'demo@lumviq.test', name: 'Demo User', passwordHash },
  })

  // Membership
  await prisma.organizationMembership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id,
      },
    },
    update: { role: 'owner', roleId: ownerRole.id },
    create: { userId: user.id, organizationId: org.id, role: 'owner', roleId: ownerRole.id },
  })

  const findOrCreateAccount = async (code, name, type) => {
    let account = await prisma.account.findFirst({ where: { organizationId: org.id, code } })
    if (!account) {
      account = await prisma.account.create({ data: { organizationId: org.id, code, name, type } })
    }
    return account
  }

  // Chart of accounts (simple)
  const cash = await findOrCreateAccount('1000', 'Cash', 'asset')
  const ar = await findOrCreateAccount('1100', 'Accounts Receivable', 'asset')
  const revenue = await findOrCreateAccount('4000', 'Sales Revenue', 'income')

  const ensureEntry = async (data) => {
    if (data.idempotencyKey) {
      const existing = await prisma.journalEntry.findUnique({ where: { idempotencyKey: data.idempotencyKey } })
      if (existing) return existing
    }

    return prisma.journalEntry.create({
      data,
      include: { lines: true },
    })
  }

  // Create a balanced journal entry: receive payment for invoice
  const je = await ensureEntry({
    organizationId: org.id,
    description: 'Demo sale received',
    posted: true,
    postedAt: new Date(),
    postingUserId: user.id,
    idempotencyKey: 'seed-demo-sale-received',
    lines: {
      create: [
        { accountId: cash.id, amount: '100.00', isDebit: true, description: 'Cash receipt' },
        { accountId: revenue.id, amount: '100.00', isDebit: false, description: 'Sales revenue' },
      ],
    },
  })

  // Create an invoice journal entry (AR -> Revenue)
  const invoiceJe = await ensureEntry({
    organizationId: org.id,
    description: 'Invoice #1001 posted',
    posted: true,
    postedAt: new Date(),
    postingUserId: user.id,
    idempotencyKey: 'seed-invoice-1001',
    lines: {
      create: [
        { accountId: ar.id, amount: '250.00', isDebit: true, description: 'Accounts receivable' },
        { accountId: revenue.id, amount: '250.00', isDebit: false, description: 'Sales revenue' },
      ],
    },
  })

  // Create a vendor bill (Expense -> Accounts Payable) and payment
  const expense = await findOrCreateAccount('5000', 'Expenses', 'expense')
  const ap = await findOrCreateAccount('2000', 'Accounts Payable', 'liability')

  const billJe = await ensureEntry({
    organizationId: org.id,
    description: 'Vendor bill #B-100',
    posted: true,
    postedAt: new Date(),
    postingUserId: user.id,
    idempotencyKey: 'seed-vendor-bill-b-100',
    lines: {
      create: [
        { accountId: expense.id, amount: '80.00', isDebit: true, description: 'Office supplies' },
        { accountId: ap.id, amount: '80.00', isDebit: false, description: 'Accounts payable' },
      ],
    },
  })

  console.log('Seed complete: org=', org.id, ' user=', user.email, 'journalEntries:', je.id, invoiceJe.id, billJe.id)

  // Add more demo transactions: multiple invoices, payments and bank imports
  const moreDemo = async (orgId, userId, arAccountId, cashAccountId, revenueAccountId, apAccountId, expenseAccountId) => {
    const invoiceBase = [150, 200, 250]
    for (let i = 0; i < invoiceBase.length; i++) {
      await ensureEntry({
        organizationId: orgId,
        description: `Invoice #${1002 + i}`,
        posted: true,
        postedAt: new Date(),
        postingUserId: userId,
        idempotencyKey: `seed-invoice-${1002 + i}`,
        lines: {
          create: [
            { accountId: arAccountId, amount: `${invoiceBase[i]}.00`, isDebit: true, description: 'Accounts receivable' },
            { accountId: revenueAccountId, amount: `${invoiceBase[i]}.00`, isDebit: false, description: 'Sales revenue' },
          ],
        },
      })
    }

    await ensureEntry({
      organizationId: orgId,
      description: 'Customer payments batch',
      posted: true,
      postedAt: new Date(),
      postingUserId: userId,
      idempotencyKey: 'seed-customer-payments-batch',
      lines: {
        create: [
          { accountId: cashAccountId, amount: '200.00', isDebit: true, description: 'Cash received' },
          { accountId: arAccountId, amount: '200.00', isDebit: false, description: 'Reduce AR' },
        ],
      },
    })

    await ensureEntry({
      organizationId: orgId,
      description: 'Bank import: deposit',
      posted: true,
      postedAt: new Date(),
      postingUserId: userId,
      idempotencyKey: 'seed-bank-import-deposit',
      lines: {
        create: [
          { accountId: cashAccountId, amount: '500.00', isDebit: true, description: 'Bank deposit' },
          { accountId: revenueAccountId, amount: '500.00', isDebit: false, description: 'Unrecognized income' },
        ],
      },
    })

    await ensureEntry({
      organizationId: orgId,
      description: 'Vendor payments',
      posted: true,
      postedAt: new Date(),
      postingUserId: userId,
      idempotencyKey: 'seed-vendor-payments',
      lines: {
        create: [
          { accountId: apAccountId, amount: '80.00', isDebit: true, description: 'Reduce AP' },
          { accountId: cashAccountId, amount: '80.00', isDebit: false, description: 'Cash paid' },
        ],
      },
    })
  }

  // Connect to created demo entities to add more
  const orgAccounts = await prisma.account.findMany({ where: { organizationId: org.id } })
  const map = {}
  for (const a of orgAccounts) map[a.name] = a.id

  await moreDemo(org.id, user.id, map['Accounts Receivable'], map['Cash'], map['Sales Revenue'], map['Accounts Payable'], map['Expenses'])
  console.log('Additional demo data added')

  const bank = await prisma.bankAccount.upsert({
    where: { id: (await prisma.bankAccount.findFirst({ where: { organizationId: org.id, name: 'Demo Bank Account' } }))?.id ?? '00000000-0000-0000-0000-000000000000' },
    update: {},
    create: { organizationId: org.id, provider: 'csv', name: 'Demo Bank Account', accountNumber: '****1234', currency: 'USD' },
  }).catch(async () => {
    const existingBank = await prisma.bankAccount.findFirst({ where: { organizationId: org.id, name: 'Demo Bank Account' } })
    if (existingBank) return existingBank
    return prisma.bankAccount.create({ data: { organizationId: org.id, provider: 'csv', name: 'Demo Bank Account', accountNumber: '****1234', currency: 'USD' } })
  })

  await prisma.bankTransaction.createMany({
    data: [
      { bankAccountId: bank.id, transactionDate: new Date(), amount: 300.00, description: 'Payment from Acme', externalId: 'ext-1' },
      { bankAccountId: bank.id, transactionDate: new Date(), amount: -80.00, description: 'Payment to Vendor', externalId: 'ext-2' },
      { bankAccountId: bank.id, transactionDate: new Date(), amount: 500.00, description: 'Deposit', externalId: 'ext-3' },
    ],
  })
  console.log('Bank account and transactions seeded')

  // --- Customers, vendors, and draft invoices/bills (so the Sales/Purchasing
  // pages have visible demo records, not just raw ledger entries) ---
  const findOrCreateCustomer = async (name, email) => {
    let c = await prisma.customer.findFirst({ where: { organizationId: org.id, name } })
    if (!c) c = await prisma.customer.create({ data: { organizationId: org.id, name, email } })
    return c
  }
  const findOrCreateVendor = async (name, email) => {
    let v = await prisma.vendor.findFirst({ where: { organizationId: org.id, name } })
    if (!v) v = await prisma.vendor.create({ data: { organizationId: org.id, name, email } })
    return v
  }

  const acme = await findOrCreateCustomer('Acme Co.', 'billing@acme.example')
  const globex = await findOrCreateCustomer('Globex Inc.', 'ap@globex.example')
  const initech = await findOrCreateCustomer('Initech LLC', 'accounts@initech.example')

  const officeSupplyCo = await findOrCreateVendor('Office Supply Co.', 'sales@officesupply.example')
  const cloudHosting = await findOrCreateVendor('Cloud Hosting Partners', 'billing@cloudhosting.example')

  const findOrCreateInvoice = async (invoiceNumber, customerId, amount) => {
    let inv = await prisma.invoice.findFirst({ where: { organizationId: org.id, invoiceNumber } })
    if (inv) return inv
    return prisma.invoice.create({
      data: {
        organizationId: org.id,
        customerId,
        invoiceNumber,
        status: 'draft',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        subtotal: amount,
        total: amount,
        lines: {
          create: [
            { description: 'Consulting services', quantity: '1', unitPrice: amount, amount, accountId: revenue.id },
          ],
        },
      },
    })
  }
  const findOrCreateBill = async (billNumber, vendorId, amount) => {
    let bill = await prisma.bill.findFirst({ where: { organizationId: org.id, billNumber } })
    if (bill) return bill
    return prisma.bill.create({
      data: {
        organizationId: org.id,
        vendorId,
        billNumber,
        status: 'draft',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 86400000),
        subtotal: amount,
        total: amount,
        lines: {
          create: [
            { description: 'Monthly services', quantity: '1', unitPrice: amount, amount, accountId: expense.id },
          ],
        },
      },
    })
  }

  await findOrCreateInvoice('DEMO-1001', acme.id, '1200.00')
  await findOrCreateInvoice('DEMO-1002', globex.id, '850.00')
  await findOrCreateInvoice('DEMO-1003', initech.id, '2400.00')
  await findOrCreateBill('DEMO-B-1001', officeSupplyCo.id, '145.50')
  await findOrCreateBill('DEMO-B-1002', cloudHosting.id, '399.00')
  console.log('Demo customers, vendors, invoices and bills seeded')

  // --- Dimensions (department tagging) ---
  let deptDimension = await prisma.dimension.findFirst({ where: { organizationId: org.id, name: 'Department' } })
  if (!deptDimension) {
    deptDimension = await prisma.dimension.create({
      data: {
        organizationId: org.id,
        name: 'Department',
        values: { create: [{ name: 'Operations' }, { name: 'Marketing' }, { name: 'Engineering' }] },
      },
    })
  }

  // --- Nonprofit fund + grant (harmless for for-profit demo org too) ---
  let generalFund = await prisma.fund.findFirst({ where: { organizationId: org.id, name: 'General Fund' } })
  if (!generalFund) {
    generalFund = await prisma.fund.create({
      data: { organizationId: org.id, name: 'General Fund', type: 'unrestricted' },
    })
  }
  const existingGrant = await prisma.grant.findFirst({ where: { organizationId: org.id, name: 'Community Impact Grant' } })
  if (!existingGrant) {
    await prisma.grant.create({
      data: {
        organizationId: org.id,
        fundId: generalFund.id,
        name: 'Community Impact Grant',
        grantorName: 'Example Foundation',
        totalAwarded: '10000.00',
        amountSpent: '2500.00',
        startDate: new Date(),
        status: 'active',
      },
    })
  }

  // --- Contractor (1099) linked to a vendor ---
  const existingContractor = await prisma.contractor.findFirst({ where: { organizationId: org.id, name: 'Jordan Rivera' } })
  if (!existingContractor) {
    await prisma.contractor.create({
      data: { organizationId: org.id, name: 'Jordan Rivera', email: 'jordan@example.com', vendorId: cloudHosting.id },
    })
  }

  // --- Manual exchange rate ---
  const existingRate = await prisma.exchangeRate.findFirst({ where: { organizationId: org.id, baseCurrency: 'USD', quoteCurrency: 'EUR' } })
  if (!existingRate) {
    await prisma.exchangeRate.create({
      data: { organizationId: org.id, baseCurrency: 'USD', quoteCurrency: 'EUR', rate: '0.92', asOfDate: new Date() },
    })
  }

  console.log('Dimensions, fund/grant, contractor and exchange rate seeded')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
