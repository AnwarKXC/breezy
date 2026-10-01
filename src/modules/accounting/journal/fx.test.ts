import test from 'node:test'
import assert from 'node:assert/strict'
import { valueJournalLines } from './fx'
import { JournalCreateSchema } from './validation'

test('foreign journals require historical rates and EGP uses one', () => {
  const entry = { date: '2026-10-01', description: 'Capital', currency: 'USD', lines: [{ accountCode: '1101', debit: '1' }, { accountCode: '3101', credit: '1' }] }
  assert.equal(JournalCreateSchema.safeParse(entry).success, false)
  assert.equal(JournalCreateSchema.safeParse({ ...entry, exchangeRate: '50.12500000' }).success, true)
  for (const exchangeRate of ['0', '-1', '1e2', '1.123456789']) assert.equal(JournalCreateSchema.safeParse({ ...entry, exchangeRate }).success, false)
  assert.equal(JournalCreateSchema.safeParse({ ...entry, currency: 'EGP', exchangeRate: '2' }).success, false)
})
test('rounds at eight-decimal historical rates while preserving exact base balance', () => {
  const lines = [{ debit: '0.01', credit: '0' }, { debit: '0.01', credit: '0' }, { debit: '0', credit: '0.02' }]
  assert.deepEqual(valueJournalLines(lines, '1.5'), [{ baseDebit: '0.01', baseCredit: '0.00' }, { baseDebit: '0.02', baseCredit: '0.00' }, { baseDebit: '0.00', baseCredit: '0.03' }])
  assert.deepEqual(valueJournalLines([{ debit: '1', credit: '0' }, { debit: '0', credit: '1' }], '50.12345678'), [{ baseDebit: '50.12', baseCredit: '0.00' }, { baseDebit: '0.00', baseCredit: '50.12' }])
})
test('keeps extreme and tiny positive rates exact without floating arithmetic', () => {
  assert.deepEqual(valueJournalLines([{ debit: '9999999999.99', credit: '0' }, { debit: '0', credit: '9999999999.99' }], '9999999999.99999999'), [{ baseDebit: '99999999999899999900.00', baseCredit: '0.00' }, { baseDebit: '0.00', baseCredit: '99999999999899999900.00' }])
  assert.deepEqual(valueJournalLines([{ debit: '0.01', credit: '0' }, { debit: '0', credit: '0.01' }], '0.00000001'), [{ baseDebit: '0.00', baseCredit: '0.00' }, { baseDebit: '0.00', baseCredit: '0.00' }])
})
