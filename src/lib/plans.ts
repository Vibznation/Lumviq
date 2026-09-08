/**
 * Centralized Lumviq plan, add-on and feature-comparison configuration.
 *
 * This is the single source of truth for plan names, prices, limits and
 * feature entitlements used across the marketing site, the checkout flow
 * and server-side entitlement checks (see src/lib/entitlements.ts). No
 * page or component should hard-code a plan name, price or feature list —
 * everything reads from here so pricing/features can change without
 * touching UI code.
 *
 * Prices are provisional (USD/month) and are the only place they are
 * defined. They are not tied to any payment processor yet — see
 * src/lib/integrations/payments.ts, which is not configured.
 */

export type PlanId = 'free' | 'start' | 'grow' | 'scale' | 'enterprise'
export type BillingCycle = 'monthly' | 'annual'

/** Annual billing is charged at 10 months' worth of the monthly price (~17% savings). */
export const ANNUAL_MONTHS_CHARGED = 10

export interface PlanLimits {
  users: number | 'unlimited'
  accountantInvitations: number | 'unlimited'
  invoicesPerMonth: number | 'unlimited'
  salesChannelConnections: number | 'unlimited'
}

export interface Plan {
  id: PlanId
  name: string
  monthlyPrice: number | null // null = custom/contact sales (Enterprise)
  mostPopular?: boolean
  designedFor: string[]
  limits: PlanLimits
  /** Feature keys from FEATURE_CATALOG this plan includes (cumulative). */
  featureKeys: string[]
  /** Short bullets shown on the pricing card, in addition to "Everything in X". */
  highlights: string[]
  includesFrom?: PlanId
}

export interface FeatureDef {
  key: string
  label: string
  /** Category key from FEATURE_CATEGORIES. */
  category: string
}

export interface FeatureCategory {
  key: string
  label: string
}

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  { key: 'accounting', label: 'Accounting' },
  { key: 'sales', label: 'Sales' },
  { key: 'expenses', label: 'Expenses & Bills' },
  { key: 'projects', label: 'Projects' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'planning', label: 'Planning' },
  { key: 'nonprofit', label: 'Nonprofit' },
  { key: 'team', label: 'Team & Controls' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'support', label: 'Support' },
]

function features(category: string, entries: Array<[string, string]>): FeatureDef[] {
  return entries.map(([key, label]) => ({ key: `${category}.${key}`, label, category }))
}

export const FEATURE_CATALOG: FeatureDef[] = [
  ...features('accounting', [
    ['income-expense-tracking', 'Income and expense tracking'],
    ['double-entry-ledger', 'Double-entry ledger'],
    ['chart-of-accounts', 'Chart of accounts'],
    ['journal-entries', 'Journal entries'],
    ['bank-reconciliation', 'Bank reconciliation'],
    ['automated-categorization', 'Automated transaction categorization'],
    ['receipt-matching', 'Receipt matching'],
    ['recurring-transactions', 'Recurring transactions'],
    ['closing-periods', 'Closing periods'],
    ['audit-trail', 'Audit trail'],
  ]),
  ...features('sales', [
    ['estimates', 'Estimates'],
    ['invoices', 'Invoices'],
    ['recurring-invoices', 'Recurring invoices'],
    ['progress-invoicing', 'Progress invoicing'],
    ['customer-statements', 'Customer statements'],
    ['payment-reminders', 'Payment reminders'],
    ['online-payments', 'Online payment links'],
    ['sales-tax-tracking', 'Sales-tax tracking'],
    ['multi-currency-invoices', 'Multi-currency invoices'],
  ]),
  ...features('expenses', [
    ['bill-management', 'Bill management'],
    ['recurring-bills', 'Recurring bills'],
    ['vendor-credits', 'Vendor credits'],
    ['purchase-orders', 'Purchase orders'],
    ['expense-reimbursements', 'Expense reimbursements'],
    ['approval-workflows', 'Approval workflows'],
    ['batch-expenses', 'Batch expenses'],
    ['ap-reporting', 'Accounts-payable reporting'],
  ]),
  ...features('projects', [
    ['time-tracking', 'Time tracking'],
    ['billable-time', 'Billable time on invoices'],
    ['project-expenses', 'Project expenses'],
    ['project-budgets', 'Project budgets'],
    ['job-costing', 'Job costing'],
    ['project-profitability', 'Project profitability'],
    ['staff-allocation', 'Staff allocation'],
  ]),
  ...features('inventory', [
    ['product-records', 'Product and service records'],
    ['inventory-quantities', 'Inventory quantities'],
    ['purchase-receipts', 'Purchase receipts'],
    ['cogs', 'Cost of goods sold'],
    ['reorder-alerts', 'Reorder alerts'],
    ['multiple-locations', 'Multiple locations'],
    ['inventory-valuation', 'Inventory valuation'],
    ['product-profitability', 'Product profitability'],
  ]),
  ...features('planning', [
    ['budgets', 'Budgets'],
    ['budget-vs-actual', 'Budget vs actual'],
    ['cash-flow-forecast', 'Cash-flow forecast'],
    ['profit-forecast', 'Profit forecast'],
    ['scenario-planning', 'Scenario planning'],
    ['custom-kpis', 'Custom KPIs'],
    ['executive-dashboards', 'Executive dashboards'],
  ]),
  ...features('nonprofit', [
    ['fund-accounting', 'Fund accounting'],
    ['restricted-funds', 'Restricted funds'],
    ['grants', 'Grants'],
    ['programs', 'Programs'],
    ['donations', 'Donations'],
    ['pledges', 'Pledges'],
    ['functional-expenses', 'Functional expenses'],
    ['grant-reporting', 'Grant reporting'],
    ['board-reports', 'Board reports'],
  ]),
  ...features('team', [
    ['users', 'Users'],
    ['accountant-access', 'Accountant access'],
    ['custom-roles', 'Custom roles'],
    ['approval-limits', 'Approval limits'],
    ['audit-history', 'Audit history'],
    ['dimension-tracking', 'Class, department and location tracking'],
    ['custom-fields', 'Custom fields'],
    ['workflow-automation', 'Workflow automation'],
  ]),
  ...features('intelligence', [
    ['ai-chat', 'AI financial chat'],
    ['transaction-suggestions', 'Transaction suggestions'],
    ['reconciliation-suggestions', 'Reconciliation suggestions'],
    ['anomaly-detection', 'Anomaly detection'],
    ['payment-recommendations', 'Payment recommendations'],
    ['cash-flow-insights', 'Cash-flow insights'],
    ['forecast-explanations', 'Forecast explanations'],
    ['management-summaries', 'Management summaries'],
  ]),
  ...features('support', [
    ['community', 'Community support'],
    ['standard', 'Standard support'],
    ['priority', 'Priority support'],
    ['guided-onboarding', 'Guided onboarding'],
    ['training', 'Training'],
    ['dedicated-account-management', 'Dedicated account management'],
  ]),
]

const FEATURE_KEY_SET = new Set(FEATURE_CATALOG.map((f) => f.key))

function assertKeys(keys: string[]): string[] {
  for (const k of keys) {
    if (!FEATURE_KEY_SET.has(k)) throw new Error(`Unknown feature key in plan config: ${k}`)
  }
  return keys
}

const FREE_FEATURES = assertKeys([
  'accounting.income-expense-tracking',
  'accounting.double-entry-ledger',
  'accounting.chart-of-accounts',
  'accounting.journal-entries',
  'sales.estimates',
  'sales.invoices',
  'team.accountant-access',
  'team.users',
  'intelligence.ai-chat',
  'support.community',
])

const START_FEATURES = assertKeys([
  ...FREE_FEATURES,
  'sales.recurring-invoices',
  'sales.online-payments',
  'accounting.bank-reconciliation',
  'accounting.automated-categorization',
  'accounting.receipt-matching',
  'accounting.recurring-transactions',
  'sales.sales-tax-tracking',
  'sales.payment-reminders',
  'support.standard',
])

const GROW_FEATURES = assertKeys([
  ...START_FEATURES,
  'expenses.bill-management',
  'expenses.ap-reporting',
  'projects.time-tracking',
  'projects.billable-time',
  'projects.project-expenses',
  'projects.project-profitability',
  'expenses.purchase-orders',
  'expenses.recurring-bills',
  'expenses.expense-reimbursements',
  'sales.multi-currency-invoices',
  'expenses.approval-workflows',
  'team.dimension-tracking',
  'planning.budgets',
  'planning.cash-flow-forecast',
  'support.priority',
])

const SCALE_FEATURES = assertKeys([
  ...GROW_FEATURES,
  'inventory.product-records',
  'inventory.inventory-quantities',
  'inventory.purchase-receipts',
  'inventory.cogs',
  'inventory.reorder-alerts',
  'inventory.multiple-locations',
  'inventory.inventory-valuation',
  'inventory.product-profitability',
  'planning.profit-forecast',
  'planning.scenario-planning',
  'planning.custom-kpis',
  'planning.executive-dashboards',
  'expenses.batch-expenses',
  'sales.progress-invoicing',
  'sales.customer-statements',
  'team.custom-fields',
  'team.custom-roles',
  'team.workflow-automation',
  'accounting.closing-periods',
  'accounting.audit-trail',
  'nonprofit.fund-accounting',
  'nonprofit.restricted-funds',
  'nonprofit.grants',
  'nonprofit.programs',
  'nonprofit.donations',
  'nonprofit.pledges',
  'nonprofit.functional-expenses',
  'nonprofit.grant-reporting',
  'nonprofit.board-reports',
  'support.guided-onboarding',
])

const ENTERPRISE_FEATURES = assertKeys([
  ...SCALE_FEATURES,
  'projects.job-costing',
  'projects.staff-allocation',
  'expenses.vendor-credits',
  'team.approval-limits',
  'team.audit-history',
  'intelligence.transaction-suggestions',
  'intelligence.reconciliation-suggestions',
  'intelligence.anomaly-detection',
  'intelligence.payment-recommendations',
  'intelligence.cash-flow-insights',
  'intelligence.forecast-explanations',
  'intelligence.management-summaries',
  'support.training',
  'support.dedicated-account-management',
])

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Lumviq Free',
    monthlyPrice: 0,
    designedFor: ['New businesses', 'Freelancers', 'Users exploring Lumviq'],
    limits: { users: 1, accountantInvitations: 1, invoicesPerMonth: 20, salesChannelConnections: 0 },
    featureKeys: FREE_FEATURES,
    highlights: [
      'One organization, one primary user',
      'Up to 20 invoices per month',
      'Profit & loss, balance sheet, cash overview',
      'Basic Lumviq Intelligence explanations',
      'Full data export, always',
    ],
  },
  {
    id: 'start',
    name: 'Lumviq Start',
    monthlyPrice: 19,
    designedFor: ['Freelancers', 'Independent contractors', 'Very small businesses'],
    limits: { users: 3, accountantInvitations: 2, invoicesPerMonth: 'unlimited', salesChannelConnections: 1 },
    featureKeys: START_FEATURES,
    includesFrom: 'free',
    highlights: [
      'Unlimited invoices and recurring invoices',
      'Automatic bank imports and reconciliation',
      'Automated categorization and receipt matching',
      'Mileage tracking and 1099 contractor tracking',
      'Three users, two accountant invitations',
    ],
  },
  {
    id: 'grow',
    name: 'Lumviq Grow',
    monthlyPrice: 49,
    mostPopular: true,
    designedFor: ['Small businesses', 'Service businesses', 'Growing teams'],
    limits: { users: 10, accountantInvitations: 3, invoicesPerMonth: 'unlimited', salesChannelConnections: 3 },
    featureKeys: GROW_FEATURES,
    includesFrom: 'start',
    highlights: [
      'Bill management and accounts-payable aging',
      'Time tracking, projects and project profitability',
      'Purchase orders and recurring bills',
      'Department and location tracking',
      'Basic budgets and cash-flow forecasting',
    ],
  },
  {
    id: 'scale',
    name: 'Lumviq Scale',
    monthlyPrice: 99,
    designedFor: ['Established businesses', 'Product companies', 'Nonprofits', 'Multi-location organizations'],
    limits: { users: 25, accountantInvitations: 5, invoicesPerMonth: 'unlimited', salesChannelConnections: 'unlimited' },
    featureKeys: SCALE_FEATURES,
    includesFrom: 'grow',
    highlights: [
      'Inventory across multiple locations with COGS',
      'Advanced budgets, rolling forecasts and custom KPIs',
      'Fund accounting, grants and donor/pledge tracking',
      'Custom fields, roles and workflow automation',
      'Guided onboarding and premium support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Lumviq Enterprise',
    monthlyPrice: null,
    designedFor: ['Complex businesses', 'Finance teams', 'Large nonprofits', 'Multi-entity and international organizations'],
    limits: { users: 'unlimited', accountantInvitations: 'unlimited', invoicesPerMonth: 'unlimited', salesChannelConnections: 'unlimited' },
    featureKeys: ENTERPRISE_FEATURES,
    includesFrom: 'scale',
    highlights: [
      'Multiple legal entities with consolidated reporting',
      'Intercompany transactions and eliminations',
      'API access and webhooks',
      'Enterprise approval policies and separation of duties',
      'Dedicated implementation and account management',
    ],
  },
]

export function getPlan(planId: string): Plan {
  const plan = PLANS.find((p) => p.id === planId)
  if (!plan) throw new Error(`Unknown plan id: ${planId}`)
  return plan
}

export function planHasFeature(planId: string, featureKey: string): boolean {
  return getPlan(planId).featureKeys.includes(featureKey)
}

/** Cheapest plan (in PLANS order) that includes a given feature key, or null if none do. */
export function cheapestPlanForFeature(featureKey: string): Plan | null {
  return PLANS.find((p) => p.featureKeys.includes(featureKey)) || null
}

/**
 * Maps each FEATURE_CATALOG key to the in-app page that implements it, so
 * marketing pages (features, pricing) can link straight to real,
 * functional screens instead of only describing the capability. A
 * feature with no dedicated screen yet (still on the roadmap) is
 * intentionally omitted rather than pointed at an unrelated page — see
 * docs/roadmap.md for what remains.
 */
export const FEATURE_LINKS: Record<string, string> = {
  'accounting.income-expense-tracking': '/accounting/chart-of-accounts',
  'accounting.double-entry-ledger': '/accounting/chart-of-accounts',
  'accounting.chart-of-accounts': '/accounting/chart-of-accounts',
  'accounting.bank-reconciliation': '/banking/reconcile',
  'accounting.receipt-matching': '/banking/reconcile',
  'accounting.recurring-transactions': '/sales/recurring',
  'accounting.closing-periods': '/accounting/close-checklist',
  'accounting.audit-trail': '/settings/audit-log',

  'sales.estimates': '/sales/estimates',
  'sales.invoices': '/sales/invoices',
  'sales.recurring-invoices': '/sales/recurring',
  'sales.progress-invoicing': '/projects',
  'sales.customer-statements': '/reports?tab=Customer+Statements',
  'sales.payment-reminders': '/settings/workflows',
  'sales.sales-tax-tracking': '/settings/tax-rates',
  'sales.multi-currency-invoices': '/settings/currencies',

  'expenses.bill-management': '/purchasing/bills',
  'expenses.recurring-bills': '/sales/recurring',
  'expenses.vendor-credits': '/purchasing/vendor-credits',
  'expenses.purchase-orders': '/purchasing/purchase-orders',
  'expenses.expense-reimbursements': '/purchasing/reimbursements',
  'expenses.approval-workflows': '/approvals',
  'expenses.ap-reporting': '/reports?tab=AP+Aging',

  'projects.time-tracking': '/projects',
  'projects.billable-time': '/projects',
  'projects.project-expenses': '/projects',
  'projects.project-budgets': '/planning',
  'projects.job-costing': '/reports?tab=Job+Costing',
  'projects.project-profitability': '/reports?tab=Job+Costing',
  'projects.staff-allocation': '/projects',

  'inventory.product-records': '/inventory',
  'inventory.inventory-quantities': '/inventory',
  'inventory.purchase-receipts': '/purchasing/purchase-orders',
  'inventory.reorder-alerts': '/inventory',
  'inventory.multiple-locations': '/inventory',
  'inventory.inventory-valuation': '/reports?tab=Inventory+Valuation',
  'inventory.product-profitability': '/reports?tab=Product+Profitability',

  'planning.budgets': '/planning',
  'planning.budget-vs-actual': '/planning',
  'planning.scenario-planning': '/planning?tab=Scenarios',
  'planning.custom-kpis': '/planning?tab=KPIs+%2F+Executive+dashboard',
  'planning.executive-dashboards': '/planning?tab=KPIs+%2F+Executive+dashboard',

  'nonprofit.fund-accounting': '/settings/funds',
  'nonprofit.restricted-funds': '/settings/funds',
  'nonprofit.grants': '/settings/funds',
  'nonprofit.programs': '/settings/dimensions',
  'nonprofit.donations': '/settings/funds',
  'nonprofit.pledges': '/settings/funds',
  'nonprofit.board-reports': '/reports',

  'team.users': '/settings/organization',
  'team.accountant-access': '/accountants',
  'team.custom-roles': '/settings/roles',
  'team.approval-limits': '/settings/approval-thresholds',
  'team.audit-history': '/settings/audit-log',
  'team.dimension-tracking': '/settings/dimensions',
  'team.custom-fields': '/settings/custom-fields',
  'team.workflow-automation': '/settings/workflows',

  'intelligence.ai-chat': '/intelligence?tab=Chat',
  'intelligence.reconciliation-suggestions': '/banking/reconcile',
  'intelligence.anomaly-detection': '/intelligence',
  'intelligence.payment-recommendations': '/intelligence',
  'intelligence.cash-flow-insights': '/intelligence',
  'intelligence.management-summaries': '/intelligence',

  'support.community': '/support',
  'support.standard': '/support',
  'support.priority': '/support',
  'support.guided-onboarding': '/onboarding',
  'support.dedicated-account-management': '/support',
}

/** In-app page implementing a feature, or null if it has no dedicated screen yet. */
export function featureLink(featureKey: string): string | null {
  return FEATURE_LINKS[featureKey] || null
}

/** Renewal/charged price for a plan at a given billing cycle. Null = contact sales. */
export function planPrice(planId: string, cycle: BillingCycle): number | null {
  const plan = getPlan(planId)
  if (plan.monthlyPrice === null) return null
  return cycle === 'annual' ? plan.monthlyPrice * ANNUAL_MONTHS_CHARGED : plan.monthlyPrice
}

/** What the customer sees as "per month" for display purposes (annual price divided by 12). */
export function planMonthlyEquivalent(planId: string, cycle: BillingCycle): number | null {
  const plan = getPlan(planId)
  if (plan.monthlyPrice === null) return null
  if (cycle === 'monthly') return plan.monthlyPrice
  return Math.round(((plan.monthlyPrice * ANNUAL_MONTHS_CHARGED) / 12) * 100) / 100
}

/** Honest annual savings vs. paying monthly for 12 months, in dollars. */
export function annualSavings(planId: string): number | null {
  const plan = getPlan(planId)
  if (plan.monthlyPrice === null) return null
  return plan.monthlyPrice * 12 - plan.monthlyPrice * ANNUAL_MONTHS_CHARGED
}

// ---------------------------------------------------------------------------
// Add-ons
// ---------------------------------------------------------------------------

export type AddOnId =
  | 'payroll-start'
  | 'payroll-complete'
  | 'payroll-complete-hr'
  | 'payments'
  | 'expert-guided-setup'
  | 'expert-bookkeeping-review'
  | 'expert-monthly-bookkeeping'
  | 'expert-tax-prep-coordination'
  | 'expert-cfo-advisory'
  | 'commerce'
  | 'nonprofit-enhanced'

export interface AddOn {
  id: AddOnId
  group: 'payroll' | 'payments' | 'expert' | 'commerce' | 'nonprofit'
  name: string
  description: string
  monthlyPrice: number | null
  features: string[]
}

export const ADD_ONS: AddOn[] = [
  {
    id: 'payroll-start',
    group: 'payroll',
    name: 'Lumviq Payroll — Start',
    description: 'Basic payroll preparation and ledger posting.',
    monthlyPrice: 40,
    features: [
      'Basic payroll preparation',
      'Employee and contractor records',
      'Payroll calculations',
      'Payroll journal posting',
      'Provider integration architecture',
    ],
  },
  {
    id: 'payroll-complete',
    group: 'payroll',
    name: 'Lumviq Payroll — Complete',
    description: 'Adds time sync, benefits and multistate support.',
    monthlyPrice: 70,
    features: [
      'Everything in Payroll Start',
      'Time synchronization',
      'Benefits deductions',
      'Multistate architecture',
      'Advanced payroll reporting',
      'Expanded workforce tools',
    ],
  },
  {
    id: 'payroll-complete-hr',
    group: 'payroll',
    name: 'Lumviq Payroll — Complete + HR',
    description: 'Adds an HR document center and workforce analytics.',
    monthlyPrice: 100,
    features: [
      'Everything in Payroll Complete',
      'HR document center',
      'Onboarding workflows',
      'Leave management',
      'Workforce analytics',
      'Compliance reminders',
    ],
  },
  {
    id: 'payments',
    group: 'payments',
    name: 'Lumviq Payments',
    description: 'Accept online payments against invoices once a processor is configured.',
    monthlyPrice: 0,
    features: [
      'Card payments',
      'ACH payments',
      'Payment links',
      'Recurring payments',
      'Payment reminders',
      'Deposits',
      'Refunds',
      'Processor-fee accounting',
      'Payout reconciliation',
    ],
  },
  {
    id: 'expert-guided-setup',
    group: 'expert',
    name: 'Lumviq Expert — Guided Setup',
    description: 'Human-assisted onboarding for your chart of accounts and first close.',
    monthlyPrice: null,
    features: ['Guided setup session', 'Chart-of-accounts review'],
  },
  {
    id: 'expert-bookkeeping-review',
    group: 'expert',
    name: 'Lumviq Expert — Bookkeeping Review',
    description: 'Periodic human review of your books.',
    monthlyPrice: null,
    features: ['Periodic bookkeeping review'],
  },
  {
    id: 'expert-monthly-bookkeeping',
    group: 'expert',
    name: 'Lumviq Expert — Monthly Bookkeeping',
    description: 'Ongoing human bookkeeping support.',
    monthlyPrice: null,
    features: ['Monthly bookkeeping support'],
  },
  {
    id: 'expert-tax-prep-coordination',
    group: 'expert',
    name: 'Lumviq Expert — Tax Preparation Coordination',
    description: 'Coordination with a tax preparer using your Lumviq data.',
    monthlyPrice: null,
    features: ['Tax preparation coordination'],
  },
  {
    id: 'expert-cfo-advisory',
    group: 'expert',
    name: 'Lumviq Expert — CFO Advisory',
    description: 'Strategic financial advisory support.',
    monthlyPrice: null,
    features: ['CFO advisory sessions'],
  },
  {
    id: 'commerce',
    group: 'commerce',
    name: 'Lumviq Commerce',
    description: 'Additional sales channels, warehouses and point-of-sale integrations.',
    monthlyPrice: 25,
    features: [
      'Additional sales channels',
      'Advanced inventory',
      'Additional warehouses',
      'Point-of-sale integrations',
      'E-commerce synchronization',
    ],
  },
  {
    id: 'nonprofit-enhanced',
    group: 'nonprofit',
    name: 'Lumviq Nonprofit — Enhanced',
    description: 'Advanced grant compliance and donor tools beyond what Scale includes.',
    monthlyPrice: 35,
    features: [
      'Advanced grant compliance',
      'Donor portal',
      'Scholarship management',
      'Outcome reporting',
      'Advanced allocations',
      'Specialized implementation',
    ],
  },
]

export function getAddOn(id: string): AddOn {
  const addOn = ADD_ONS.find((a) => a.id === id)
  if (!addOn) throw new Error(`Unknown add-on id: ${id}`)
  return addOn
}

/** Human-readable note about live payment processing — never claim it's active without a configured processor. */
export const PAYMENTS_ADDON_STATUS =
  'Lumviq Payments requires a licensed payment processor to be configured for your organization. Until then, invoices can be marked paid manually or reconciled from imported bank activity.'

export const PAYROLL_ADDON_STATUS =
  'Lumviq does not calculate tax withholding, file payroll tax returns, or perform direct deposit. Payroll add-ons record the accounting impact of a pay run; run payroll with a licensed provider and enter the resulting totals.'

// ---------------------------------------------------------------------------
// Everything-includes list (shown once beneath the pricing cards)
// ---------------------------------------------------------------------------

export const ALL_PLANS_INCLUDE: string[] = [
  'Genuine double-entry accounting',
  'Secure cloud access',
  'Financial data ownership',
  'Data export',
  'Accountant collaboration',
  'Core financial statements',
  'Lumviq help center',
  'Responsive access on any device',
  'No long-term contract',
  'Upgrade or downgrade controls',
  'Transparent billing',
]

export function addOnMonthlyPrice(addOnId: string, cycle: BillingCycle): number | null {
  const addOn = getAddOn(addOnId)
  if (addOn.monthlyPrice === null) return null
  return cycle === 'annual' ? addOn.monthlyPrice * ANNUAL_MONTHS_CHARGED : addOn.monthlyPrice
}

export interface OrderSummaryInput {
  planId: string
  cycle: BillingCycle
  addOnIds: string[]
}

export interface OrderSummary {
  planId: string
  planName: string
  cycle: BillingCycle
  planCharge: number | null
  addOns: Array<{ id: string; name: string; charge: number | null }>
  /** Sum of known (non-custom) charges. Null components are excluded and called out separately. */
  subtotal: number
  hasCustomPricing: boolean
  renewalNote: string
}

/** Computes an honest order summary. Never invents a number for custom/contact-sales pricing. */
export function computeOrderSummary(input: OrderSummaryInput): OrderSummary {
  const plan = getPlan(input.planId)
  const planCharge = planPrice(input.planId, input.cycle)
  const addOns = input.addOnIds.map((id) => {
    const addOn = getAddOn(id)
    return { id, name: addOn.name, charge: addOnMonthlyPrice(id, input.cycle) }
  })
  let hasCustomPricing = planCharge === null
  let subtotal = planCharge ?? 0
  for (const a of addOns) {
    if (a.charge === null) hasCustomPricing = true
    else subtotal += a.charge
  }
  const renewalNote =
    input.cycle === 'annual'
      ? `Billed annually. Renews at the then-current annual price unless cancelled.`
      : `Billed monthly. Renews at the then-current monthly price unless cancelled.`
  return {
    planId: plan.id,
    planName: plan.name,
    cycle: input.cycle,
    planCharge,
    addOns,
    subtotal,
    hasCustomPricing,
    renewalNote,
  }
}
