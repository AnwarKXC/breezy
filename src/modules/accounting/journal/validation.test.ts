import assert from 'node:assert/strict'
import test from 'node:test'
import { JournalCreateSchema, JournalPeriodSchema, moneyToCents, centsToMoney } from './validation'

const valid = { date: '2026-10-01', currency: 'EGP', description: 'Opening cash', lines: [{ accountCode: '1101', debit: '0.30' }, { accountCode: '3101', credit: '0.30' }] }

test('balanced decimal amounts remain exact', () => {
  assert.equal(moneyToCents('0.10') + moneyToCents('0.20'), moneyToCents('0.30'))
  assert.equal(centsToMoney(BigInt(-123)), '-1.23')
  assert.equal(JournalCreateSchema.safeParse(valid).success, true)
})
test('rejects unbalanced, one-line and double-sided entries', () => {
  assert.equal(JournalCreateSchema.safeParse({ ...valid, lines: [valid.lines[0], { accountCode: '3101', credit: '0.31' }] }).success, false)
  assert.equal(JournalCreateSchema.safeParse({ ...valid, lines: [valid.lines[0]] }).success, false)
  assert.equal(JournalCreateSchema.safeParse({ ...valid, lines: [{ accountCode: '1101', debit: '1', credit: '1' }, valid.lines[1]] }).success, false)
  assert.equal(JournalCreateSchema.safeParse({ ...valid, lines: [{ accountCode: '1101', debit: '1' }, { accountCode: '1101', credit: '1' }] }).success, false)
})
test('rejects invalid dates, unsupported currencies and imprecise amounts', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '01/10/2026']) assert.equal(JournalCreateSchema.safeParse({ ...valid, date }).success, false)
  assert.equal(JournalCreateSchema.safeParse({ ...valid, date: '2028-02-29' }).success, true)
  assert.equal(JournalCreateSchema.safeParse({ ...valid, currency: 'JPY' }).success, false)
  for (const debit of ['-1', '1e2', 'NaN', '0.001', '10000000000.00']) assert.equal(JournalCreateSchema.safeParse({ ...valid, lines: [{ accountCode: '1101', debit }, valid.lines[1]] }).success, false)
  assert.equal(JournalCreateSchema.safeParse({ ...valid, lines: [{ accountCode: '1101', debit: 0.3 }, valid.lines[1]] }).success, false)
})
test('validates period identifiers and strict mutation contracts', () => {
  assert.equal(JournalPeriodSchema.safeParse({ month: '2026-10', action: 'close' }).success, true)
  assert.equal(JournalPeriodSchema.safeParse({ month: '2026-00', action: 'close' }).success, false)
  assert.equal(JournalCreateSchema.safeParse({ ...valid, createdBy: 'spoofed' }).success, false)
})
test('supports contact transfers while rejecting meaningless same-contact offsets', () => {
  const lines = [
    { accountCode: '1201', contactId: '11111111-1111-4111-8111-111111111111', debit: '10.00' },
    { accountCode: '1201', contactId: '22222222-2222-4222-8222-222222222222', credit: '10.00' },
  ]
  assert.equal(JournalCreateSchema.safeParse({ ...valid, lines }).success, true)
  assert.equal(JournalCreateSchema.safeParse({ ...valid, lines: [lines[0], { ...lines[1], contactId: lines[0].contactId }] }).success, false)
})
