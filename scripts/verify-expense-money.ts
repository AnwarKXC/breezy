import assert from 'node:assert/strict'
import { AccountingExpenseCreateSchema } from '../src/shared/validation'
import { expenseTotals, formatExpenseAmount } from '../src/modules/accounting/utils/expenseMoney'

const expense = { category_id: '00000000-0000-4000-8000-000000000001', description: 'Hotel supplies', date: '2026-10-01', currency: 'USD' }
assert.deepEqual(expenseTotals([
  { currency: 'EGP', totalAmount: 100 }, { currency: 'USD', totalAmount: 20 },
  { currency: 'EGP', totalAmount: 50 }, { currency: null, totalAmount: 10 },
]), [{ currency: 'EGP', amount: 150 }, { currency: 'USD', amount: 20 }, { currency: 'UNKNOWN', amount: 10 }])
assert.match(formatExpenseAmount(10, null), /unresolved/)
assert.equal(AccountingExpenseCreateSchema.parse({ ...expense, amount: 100, tax_amount: 14 }).total_amount, 114)
assert.equal(AccountingExpenseCreateSchema.parse({ ...expense, total_amount: 114, tax_amount: 14 }).amount, 100)
assert.equal(AccountingExpenseCreateSchema.safeParse({ ...expense, amount: 100, tax_amount: 14, total_amount: 100 }).success, false)
assert.equal(AccountingExpenseCreateSchema.safeParse({ ...expense, amount: 1.001 }).success, false)
assert.equal(AccountingExpenseCreateSchema.safeParse({ ...expense, total_amount: 10, tax_amount: 11 }).success, false)
assert.equal(AccountingExpenseCreateSchema.safeParse({ ...expense, amount: 0 }).success, false)
assert.equal(AccountingExpenseCreateSchema.safeParse({ ...expense, amount: 1, currency: 'XYZ' }).success, false)
assert.equal(AccountingExpenseCreateSchema.safeParse({ ...expense, amount: Number.NaN }).success, false)
assert.equal(AccountingExpenseCreateSchema.safeParse({ ...expense, amount: 100000000 }).success, false)
console.log('PASS 11 expense currency, tax consistency, precision and unresolved-history checks')
