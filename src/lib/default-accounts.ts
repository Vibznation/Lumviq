/**
 * Starting chart of accounts generated for a new organization.
 * Kept intentionally small for the MVP; accountants can add or edit
 * accounts afterwards from the Chart of Accounts screen.
 */
export type DefaultAccount = {
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  subtype?: string
}

const BUSINESS_DEFAULTS: DefaultAccount[] = [
  { code: '1000', name: 'Cash and Bank', type: 'asset', subtype: 'bank' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'receivable' },
  { code: '1200', name: 'Inventory Asset', type: 'asset', subtype: 'inventory' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'payable' },
  { code: '2100', name: 'Payroll Liabilities', type: 'liability', subtype: 'payroll_liability' },
  { code: '2110', name: 'Payroll Taxes Payable', type: 'liability', subtype: 'payroll_tax_liability' },
  { code: '3000', name: "Owner's Equity", type: 'equity' },
  { code: '3900', name: 'Retained Earnings', type: 'equity' },
  { code: '4000', name: 'Sales Revenue', type: 'income' },
  { code: '5000', name: 'General Expenses', type: 'expense' },
  { code: '5100', name: 'Cost of Goods Sold', type: 'expense', subtype: 'cogs' },
  { code: '5200', name: 'Payroll Expense', type: 'expense', subtype: 'payroll_expense' },
  { code: '5210', name: 'Payroll Tax Expense', type: 'expense', subtype: 'payroll_tax_expense' },
]

const NONPROFIT_DEFAULTS: DefaultAccount[] = [
  { code: '1000', name: 'Cash and Bank', type: 'asset', subtype: 'bank' },
  { code: '1100', name: 'Pledges Receivable', type: 'asset', subtype: 'receivable' },
  { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'payable' },
  { code: '2100', name: 'Payroll Liabilities', type: 'liability', subtype: 'payroll_liability' },
  { code: '2110', name: 'Payroll Taxes Payable', type: 'liability', subtype: 'payroll_tax_liability' },
  { code: '3000', name: 'Net Assets Without Donor Restrictions', type: 'equity' },
  { code: '3100', name: 'Net Assets With Donor Restrictions', type: 'equity' },
  { code: '4000', name: 'Contributions and Grants', type: 'income' },
  { code: '5000', name: 'Program Expenses', type: 'expense' },
  { code: '5900', name: 'Administrative Expenses', type: 'expense' },
  { code: '5910', name: 'Payroll Expense', type: 'expense', subtype: 'payroll_expense' },
  { code: '5920', name: 'Payroll Tax Expense', type: 'expense', subtype: 'payroll_tax_expense' },
]

export function defaultChartOfAccounts(orgType: string | null | undefined): DefaultAccount[] {
  return orgType === 'nonprofit' ? NONPROFIT_DEFAULTS : BUSINESS_DEFAULTS
}
