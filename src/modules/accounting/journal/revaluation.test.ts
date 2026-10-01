import assert from 'node:assert/strict'
import test from 'node:test'
import { revaluationAmounts } from './revaluation'
import { JournalRevaluationSchema } from './validation'

test('revaluation derives asset gains and liability losses without changing nominal amounts', () => {
  assert.deepEqual(revaluationAmounts('10.00', '500.00', '51'), { nativeBalance: '10.00', baseBefore: '500.00', baseAfter: '510.00', delta: '10.00' })
  assert.equal(revaluationAmounts('-10.00', '-500.00', '51').delta, '-10.00')
  assert.equal(revaluationAmounts('0.00', '1.00', '51').delta, '-1.00')
  assert.equal(revaluationAmounts('-0.01', '0.00', '1.5').baseAfter, '-0.02')
})
test('revaluation only accepts explicit foreign monetary scopes and sourced closing rates', () => {
  const valid = { date: '2026-10-31', currency: 'USD', accountCode: '1101', closingRate: '50', source: 'Bank closing quote' }
  assert.equal(JournalRevaluationSchema.safeParse(valid).success, true)
  for (const accountCode of ['1301', '2201', '2301', '4101']) assert.equal(JournalRevaluationSchema.safeParse({ ...valid, accountCode }).success, false)
  assert.equal(JournalRevaluationSchema.safeParse({ ...valid, currency: 'EGP' }).success, false)
  assert.equal(JournalRevaluationSchema.safeParse({ ...valid, accountCode: '1201' }).success, false)
  assert.equal(JournalRevaluationSchema.safeParse({ ...valid, delta: '999' }).success, false)
})
