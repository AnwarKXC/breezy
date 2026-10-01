import assert from 'node:assert/strict'
import { test } from 'node:test'
import { convertAmount, convertMoney } from './rates'

// USD-based table: 1 USD = 50 EGP = 0.9 EUR.
const rates = { USD: 1, EGP: 50, EUR: 0.9 }

test('cross-converts through the USD base', () => {
  assert.equal(convertAmount(10, 'USD', 'EGP', rates), 500)
  assert.equal(convertAmount(500, 'EGP', 'USD', rates), 10)
  assert.equal(Math.round(convertAmount(90, 'EUR', 'EGP', rates)! * 100) / 100, 5000)
  assert.equal(convertAmount(7, 'GBP', 'GBP', {}), 7)
})

test('sums mixed rows in the target currency', () => {
  assert.equal(convertMoney([{ amount: 100, currency: 'EGP' }, { amount: 10, currency: 'USD' }], 'EGP', rates), 600)
})

test('unknown currencies or missing/invalid rates give no total instead of a partial one', () => {
  assert.equal(convertMoney([{ amount: 5, currency: 'UNKNOWN' }], 'EGP', rates), null)
  assert.equal(convertMoney([{ amount: 5, currency: null }], 'EGP', rates), null)
  assert.equal(convertMoney([{ amount: 5, currency: 'GBP' }], 'EGP', rates), null)
  for (const bad of [0, -1, Infinity, NaN]) assert.equal(convertMoney([{ amount: 5, currency: 'EUR' }], 'EGP', { ...rates, EUR: bad }), null)
})
