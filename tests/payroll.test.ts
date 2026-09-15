import { describe, it, expect, vi } from 'vitest'
import { postPayRunToLedger } from '../src/lib/payroll'

function makeTx(accounts: Record<string, any>) {
  return {
    account: {
      findFirst: vi.fn(async ({ where }: any) => accounts[where.subtype] || null),
    },
    journalEntry: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({ id: 'je1', lines: data.lines.create })),
    },
    auditEvent: { create: vi.fn(async () => ({})) },
  }
}

const payPeriodStart = new Date('2026-01-01')
const payPeriodEnd = new Date('2026-01-15')

describe('payroll.ts postPayRunToLedger', () => {
  it('posts gross-only pay run when no taxes are entered', async () => {
    const tx = makeTx({ payroll_expense: { id: 'exp1' }, payroll_liability: { id: 'liab1' } })
    const payRun = {
      id: 'pr1', organizationId: 'org', payPeriodStart, payPeriodEnd, journalEntryId: null,
      totalGross: '1000', totalEmployeeTax: '0', totalEmployerTax: '0',
    }
    const entry = await postPayRunToLedger(tx as any, payRun, 'actor1')
    expect(entry.lines).toEqual([
      { accountId: 'exp1', amount: '1000', isDebit: true, description: 'Gross payroll expense' },
      { accountId: 'liab1', amount: '1000.000000', isDebit: false, description: 'Net pay owed to employees' },
    ])
  })

  it('posts the full matrix with employee withholding and employer taxes', async () => {
    const tx = makeTx({
      payroll_expense: { id: 'exp1' },
      payroll_liability: { id: 'liab1' },
      payroll_tax_expense: { id: 'taxexp1' },
      payroll_tax_liability: { id: 'taxliab1' },
    })
    const payRun = {
      id: 'pr2', organizationId: 'org', payPeriodStart, payPeriodEnd, journalEntryId: null,
      totalGross: '1000', totalEmployeeTax: '150', totalEmployerTax: '80',
    }
    const entry = await postPayRunToLedger(tx as any, payRun, 'actor1')
    expect(entry.lines).toHaveLength(4)
    expect(entry.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 'exp1', amount: '1000', isDebit: true }),
      expect.objectContaining({ accountId: 'taxexp1', amount: '80.000000', isDebit: true }),
      expect.objectContaining({ accountId: 'liab1', amount: '850.000000', isDebit: false }),
      expect.objectContaining({ accountId: 'taxliab1', amount: '230.000000', isDebit: false }),
    ]))
  })

  it('throws when employer tax is entered but no Payroll Tax Expense account is configured', async () => {
    const tx = makeTx({ payroll_expense: { id: 'exp1' }, payroll_liability: { id: 'liab1' } })
    const payRun = {
      id: 'pr3', organizationId: 'org', payPeriodStart, payPeriodEnd, journalEntryId: null,
      totalGross: '1000', totalEmployeeTax: '0', totalEmployerTax: '50',
    }
    await expect(postPayRunToLedger(tx as any, payRun, 'actor1')).rejects.toThrow(/Payroll Tax Expense/)
  })

  it('throws when Payroll Expense/Liabilities accounts are missing entirely', async () => {
    const tx = makeTx({})
    const payRun = {
      id: 'pr4', organizationId: 'org', payPeriodStart, payPeriodEnd, journalEntryId: null,
      totalGross: '1000', totalEmployeeTax: '0', totalEmployerTax: '0',
    }
    await expect(postPayRunToLedger(tx as any, payRun, 'actor1')).rejects.toThrow()
  })

  it('is idempotent when journalEntryId is already set', async () => {
    const existing = { id: 'je-existing', lines: [] }
    const tx = { journalEntry: { findUnique: vi.fn(async () => existing), create: vi.fn() } }
    const payRun = { id: 'pr5', organizationId: 'org', journalEntryId: 'je-existing' }
    const entry = await postPayRunToLedger(tx as any, payRun, 'actor1')
    expect(entry).toBe(existing)
    expect(tx.journalEntry.create).not.toHaveBeenCalled()
  })

  it('posts deductions, garnishments, reimbursements, and employer benefits cost', async () => {
    const tx = makeTx({
      payroll_expense: { id: 'exp1' },
      payroll_liability: { id: 'liab1' },
      payroll_tax_expense: { id: 'taxexp1' },
      payroll_tax_liability: { id: 'taxliab1' },
      payroll_deductions_liability: { id: 'dedliab1' },
      garnishments_payable: { id: 'garnliab1' },
      employer_benefits_expense: { id: 'benexp1' },
      employer_benefits_payable: { id: 'benliab1' },
      reimbursement_expense: { id: 'reimexp1' },
    })
    const payRun = {
      id: 'pr6', organizationId: 'org', payPeriodStart, payPeriodEnd, journalEntryId: null,
      totalGross: '1000', totalEmployeeTax: '150', totalEmployerTax: '80',
      totalPretaxDeductions: '50', totalPosttaxDeductions: '25', totalGarnishments: '40',
      totalReimbursements: '20', totalEmployerBenefitsCost: '60',
    }
    const entry = await postPayRunToLedger(tx as any, payRun, 'actor1')
    // net pay = 1000 - 150 - 50 - 25 - 40 + 20 = 755
    expect(entry.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountId: 'exp1', amount: '1000', isDebit: true }),
      expect.objectContaining({ accountId: 'taxexp1', amount: '80.000000', isDebit: true }),
      expect.objectContaining({ accountId: 'benexp1', amount: '60.000000', isDebit: true }),
      expect.objectContaining({ accountId: 'reimexp1', amount: '20.000000', isDebit: true }),
      expect.objectContaining({ accountId: 'liab1', amount: '755.000000', isDebit: false }),
      expect.objectContaining({ accountId: 'taxliab1', amount: '230.000000', isDebit: false }),
      expect.objectContaining({ accountId: 'dedliab1', amount: '75.000000', isDebit: false }),
      expect.objectContaining({ accountId: 'garnliab1', amount: '40.000000', isDebit: false }),
      expect.objectContaining({ accountId: 'benliab1', amount: '60.000000', isDebit: false }),
    ]))
    expect(entry.lines).toHaveLength(9)
  })

  it('throws when garnishments are entered but no Garnishments Payable account is configured', async () => {
    const tx = makeTx({ payroll_expense: { id: 'exp1' }, payroll_liability: { id: 'liab1' } })
    const payRun = {
      id: 'pr7', organizationId: 'org', payPeriodStart, payPeriodEnd, journalEntryId: null,
      totalGross: '1000', totalEmployeeTax: '0', totalEmployerTax: '0', totalGarnishments: '40',
    }
    await expect(postPayRunToLedger(tx as any, payRun, 'actor1')).rejects.toThrow(/Garnishments Payable/)
  })

  it('throws when employer benefits cost is entered but expense/payable accounts are missing', async () => {
    const tx = makeTx({ payroll_expense: { id: 'exp1' }, payroll_liability: { id: 'liab1' } })
    const payRun = {
      id: 'pr8', organizationId: 'org', payPeriodStart, payPeriodEnd, journalEntryId: null,
      totalGross: '1000', totalEmployeeTax: '0', totalEmployerTax: '0', totalEmployerBenefitsCost: '60',
    }
    await expect(postPayRunToLedger(tx as any, payRun, 'actor1')).rejects.toThrow(/Employer Benefits/)
  })
})
