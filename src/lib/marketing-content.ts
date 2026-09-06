/**
 * Centralized marketing-site content: nav structure, industries, modules,
 * trust statements, integrations categories, security highlights, FAQ and
 * the announcement bar message. Keeping this in one file (instead of
 * scattering copy across every marketing page) makes it easy to update
 * without touching component code, and keeps claims consistent — e.g. an
 * integration is only ever labeled "Connected" in one place.
 */

export interface NavDropdownItem {
  label: string
  href: string
  description?: string
}

export interface NavItem {
  label: string
  href?: string
  items?: NavDropdownItem[]
}

export const PRIMARY_NAV: NavItem[] = [
  {
    label: 'Product',
    items: [
      { label: 'Overview', href: '/', description: 'See how Lumviq brings your financial picture together.' },
      { label: 'Features', href: '/features', description: 'Explore every module in the platform.' },
      { label: 'Integrations', href: '/integrations', description: 'Banks, payments, payroll and more.' },
      { label: 'Security', href: '/security', description: 'How Lumviq protects your data.' },
    ],
  },
  { label: 'Features', href: '/features' },
  {
    label: 'Solutions',
    items: [
      { label: 'All solutions', href: '/solutions' },
      { label: 'Freelancers', href: '/solutions/freelancers' },
      { label: 'Small Businesses', href: '/solutions/small-business' },
      { label: 'Nonprofits', href: '/solutions/nonprofits' },
      { label: 'Professional Services', href: '/solutions/professional-services' },
      { label: 'Construction', href: '/solutions/construction' },
      { label: 'Retail & E-commerce', href: '/solutions/retail' },
      { label: 'Growing Enterprises', href: '/solutions/enterprise' },
    ],
  },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Accountants', href: '/accountants' },
  {
    label: 'Resources',
    items: [
      { label: 'Resource center', href: '/resources' },
      { label: 'Compare plans', href: '/compare' },
      { label: 'Talk to sales', href: '/contact-sales' },
    ],
  },
]

export const ANNOUNCEMENT_MESSAGE = 'Launch offer: save on your first three months of Lumviq Start, Grow or Scale.'

export interface Industry {
  slug: string
  name: string
  summary: string
  adaptations: string[]
  recommendedPlan: string
}

export const INDUSTRIES: Industry[] = [
  {
    slug: 'freelancers',
    name: 'Freelancers',
    summary: 'Track income and expenses, send invoices and stay ready for tax season without the overhead of full business accounting software.',
    adaptations: [
      'Simplified income/expense workflow with fewer setup steps',
      'Estimates and invoices tailored to a single-person business',
      'Mileage and 1099 tracking activate automatically for contractor work',
    ],
    recommendedPlan: 'start',
  },
  {
    slug: 'small-business',
    name: 'Small Businesses',
    summary: 'Run day-to-day accounting, invoicing, bills and payroll in one connected system as your team grows.',
    adaptations: [
      'Bills and accounts-payable views appear once vendor activity begins',
      'Team roles and approval workflows activate as headcount grows',
      'Budgets and cash-flow forecasting surface on the dashboard',
    ],
    recommendedPlan: 'grow',
  },
  {
    slug: 'nonprofits',
    name: 'Nonprofits',
    summary: 'Track restricted and unrestricted funds, grants and programs alongside standard bookkeeping.',
    adaptations: [
      'Choosing "Nonprofit" at setup swaps in a fund-accounting chart of accounts',
      'Fund, grant, program and donor tracking appear in navigation',
      'Board-ready reports replace standard P&L framing where relevant',
    ],
    recommendedPlan: 'scale',
  },
  {
    slug: 'professional-services',
    name: 'Professional Services',
    summary: 'Track billable time, project profitability and client invoicing in a single workflow.',
    adaptations: [
      'Time tracking and project profitability become primary dashboard views',
      'Invoices can pull billable time directly from tracked hours',
      'Staff allocation and job costing surface for larger teams',
    ],
    recommendedPlan: 'grow',
  },
  {
    slug: 'construction',
    name: 'Construction',
    summary: 'Manage job costing, purchase orders and project budgets across multiple active jobs.',
    adaptations: [
      'Projects double as job-cost centers with budgets and profitability',
      'Purchase orders and vendor bills tie directly to a specific job',
      'Class/location tracking separates crews, sites or divisions',
    ],
    recommendedPlan: 'scale',
  },
  {
    slug: 'retail',
    name: 'Retail & E-commerce',
    summary: 'Track inventory, cost of goods sold and sales-channel performance together.',
    adaptations: [
      'Inventory quantities, reorder alerts and COGS activate for product-based orgs',
      'Additional sales-channel connections available via the Lumviq Commerce add-on',
      'Product profitability reporting joins standard financial statements',
    ],
    recommendedPlan: 'scale',
  },
  {
    slug: 'enterprise',
    name: 'Growing Enterprises',
    summary: 'Manage multiple entities, consolidated reporting and enterprise-grade approval controls.',
    adaptations: [
      'Multi-entity linking and consolidated (non-merged) reporting become available',
      'Custom roles, approval limits and separation-of-duties controls activate',
      'API access and webhooks connect Lumviq to your broader finance stack',
    ],
    recommendedPlan: 'enterprise',
  },
]

export interface PlatformModule {
  key: string
  name: string
  summary: string
  href: string
}

export const PLATFORM_MODULES: PlatformModule[] = [
  { key: 'accounting', name: 'Accounting', summary: 'Double-entry ledger, chart of accounts, journal entries and closing periods.', href: '/features#accounting' },
  { key: 'banking', name: 'Banking', summary: 'Import transactions and reconcile against your books.', href: '/features#accounting' },
  { key: 'sales', name: 'Sales and Invoicing', summary: 'Estimates, invoices, recurring billing and payment reminders.', href: '/features#sales' },
  { key: 'expenses', name: 'Bills and Expenses', summary: 'Vendor bills, purchase orders and approval workflows.', href: '/features#expenses' },
  { key: 'payments', name: 'Payments', summary: 'Collect online payments once a processor is configured.', href: '/features#sales' },
  { key: 'payroll', name: 'Payroll', summary: 'Record the accounting impact of pay runs from your provider of choice.', href: '/pricing#addons' },
  { key: 'inventory', name: 'Inventory', summary: 'Products, stock levels, reorder alerts and cost of goods sold.', href: '/features#inventory' },
  { key: 'projects', name: 'Projects and Time', summary: 'Time tracking, project budgets and profitability.', href: '/features#projects' },
  { key: 'planning', name: 'Budgets and Forecasting', summary: 'Budgets, cash-flow forecasts and scenario planning.', href: '/features#planning' },
  { key: 'tax', name: 'Tax Readiness', summary: 'Sales-tax tracking and tax-summary reporting.', href: '/features#sales' },
  { key: 'nonprofit', name: 'Nonprofit Funds and Grants', summary: 'Restricted funds, grants, programs and donor tracking.', href: '/features#nonprofit' },
  { key: 'multi-entity', name: 'Multi-Entity Management', summary: 'Link related organizations and view consolidated figures side by side.', href: '/features#team' },
  { key: 'reports', name: 'Reports and Analytics', summary: 'Financial statements, aging reports and budget vs actual.', href: '/features#planning' },
  { key: 'intelligence', name: 'Lumviq Intelligence', summary: 'Deterministic, explainable insights you review and approve.', href: '/features#intelligence' },
]

export const TRUST_STATEMENTS: string[] = [
  'Built on double-entry accounting',
  'Human-controlled AI',
  'Secure cloud access',
  'Complete data export',
  'Designed for businesses and nonprofits',
]

export const VALUE_PILLARS: Array<{ title: string; description: string; moduleKey: string }> = [
  { title: 'Stay organized automatically', description: 'Bank imports, automated categorization and receipt matching keep your books current without manual entry.', moduleKey: 'accounting' },
  { title: 'Get paid with less friction', description: 'Recurring invoices, payment reminders and online payment links help you collect what you\u2019re owed.', moduleKey: 'sales' },
  { title: 'Understand your financial position', description: 'Real-time reports, aging schedules and cash-flow forecasts show where you stand.', moduleKey: 'reports' },
  { title: 'Grow without changing platforms', description: 'Inventory, projects, payroll accounting and multi-entity support activate as you need them.', moduleKey: 'multi-entity' },
]

export interface IntegrationCategory {
  category: string
  examples: string[]
  status: 'planned'
}

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  { category: 'Banks', examples: ['Bank feed connections for major financial institutions'], status: 'planned' },
  { category: 'Payments', examples: ['Card and ACH processing'], status: 'planned' },
  { category: 'Payroll', examples: ['Licensed payroll providers'], status: 'planned' },
  { category: 'E-commerce', examples: ['Storefront and marketplace sales channels'], status: 'planned' },
  { category: 'Point of Sale', examples: ['In-person retail systems'], status: 'planned' },
  { category: 'CRM', examples: ['Customer relationship management systems'], status: 'planned' },
  { category: 'Tax', examples: ['Tax preparation and filing systems'], status: 'planned' },
  { category: 'Productivity', examples: ['Calendar and communication tools'], status: 'planned' },
  { category: 'Document Storage', examples: ['Cloud document and receipt storage'], status: 'planned' },
]

export const SECURITY_HIGHLIGHTS: string[] = [
  'Encryption of data in transit',
  'Multifactor authentication',
  'Role-based access control',
  'Audit history on financial records',
  'Secure document storage',
  'Regular backups',
  'Tenant isolation between organizations',
  'Human approval controls on sensitive actions',
  'Complete data export at any time',
]

export const ACCOUNTANT_COLLABORATION: string[] = [
  'Accountant invitations',
  'Accountant Mode',
  'Journal and reconciliation tools',
  'Month-end close',
  'Audit trails',
  'Client organization switching',
  'Report exports',
  'Review and approval workflows',
]

export interface FaqItem {
  question: string
  answer: string
}

export const FAQ_ITEMS: FaqItem[] = [
  { question: 'What is Lumviq?', answer: 'Lumviq is a complete accounting platform that brings your books, banking, invoices, bills, payroll accounting, inventory, projects and planning into one place.' },
  { question: 'Is Lumviq accounting software?', answer: 'Yes. Lumviq is built on genuine double-entry accounting, with a chart of accounts, journal entries and financial statements underneath every workflow.' },
  { question: 'Who is Lumviq designed for?', answer: 'Freelancers, small businesses, growing teams, nonprofits and organizations managing multiple entities.' },
  { question: 'Can I invite my accountant?', answer: 'Yes. Every plan includes at least one accountant invitation, and higher plans include more.' },
  { question: 'Can I migrate from another platform?', answer: 'Lumviq supports manual entry and bank-transaction import today. Dedicated migration tooling is on our roadmap.' },
  { question: 'Does Lumviq support nonprofits?', answer: 'Yes. Fund accounting, restricted funds, grants, programs and donor/pledge tracking are included starting on Lumviq Scale.' },
  { question: 'Does Lumviq include payroll?', answer: 'Lumviq records the accounting impact of a pay run \u2014 gross wages, tax withholding and employer taxes reported by your provider. It does not calculate withholding, file returns or perform direct deposit itself.' },
  { question: 'Can I manage inventory?', answer: 'Yes. Product records, stock quantities, reorder alerts and cost-of-goods-sold tracking are included starting on Lumviq Scale.' },
  { question: 'Can I manage multiple organizations?', answer: 'Yes. You can link related organizations and view consolidated, side-by-side figures without merging their ledgers.' },
  { question: 'How does Lumviq Intelligence work?', answer: 'Lumviq Intelligence uses deterministic, explainable methods \u2014 not a black-box model \u2014 to suggest categorizations, flag anomalies and forecast cash flow. Every insight shows its basis.' },
  { question: 'Can AI change my books automatically?', answer: 'No. Lumviq Intelligence recommends; you review and approve. It does not independently file taxes, transfer money, run payroll, close periods or post high-risk journal entries.' },
  { question: 'Can I upgrade or cancel?', answer: 'Yes. You can upgrade, downgrade or cancel at any time from your billing settings. There is no long-term contract.' },
  { question: 'Is my financial information secure?', answer: 'Lumviq uses encryption, multifactor authentication, role-based access and tenant isolation between organizations. See the Security page for details.' },
  { question: 'Can I export my information?', answer: 'Yes, on every plan, including Free. Your financial data belongs to you.' },
]
