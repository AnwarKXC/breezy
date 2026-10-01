import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatMoney, formatMoneyTotals } from './CurrencyContext'

test('unknown historical currency stays separate from EGP', () => {
  const rows = [{ amount: 100, currency: 'EGP' }, { amount: 20, currency: 'UNKNOWN' }, { amount: 5, currency: null }]
  assert.equal(formatMoneyTotals(rows, 'EGP'), `${formatMoney(100, 'EGP')} · UNKNOWN 25`)
  assert.equal(formatMoney(7, 'UNKNOWN'), 'UNKNOWN 7')
})
