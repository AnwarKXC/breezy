import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AccountingPaymentCreateSchema } from '@/shared/validation'
import { deriveInvoiceStatus } from './deriveInvoiceStatus'
import { subtractMoney, toMoney } from '@/shared/currency/money'
import { calculateInvoiceTotals, mapInvoiceItemsForInsert } from './accountingUtils'
import { createInitialState } from '../utils/invoiceWizardState'
import { buildCreatePayload } from '../utils/invoiceWizardValidation'

test('wizard with receipts creates issued invoices and explicit save draft stays draft', () => {
  const state = createInitialState('manual')
  state.status = 'draft'
  state.recordPayment = true
  assert.equal(buildCreatePayload(state).status, 'issued')
  assert.equal(buildCreatePayload(state, true).status, 'draft')
  // Legacy drafts may still carry a settled status; it must never be submitted as-is.
  ;(state as { status: string }).status = 'paid'
  assert.equal(buildCreatePayload(state).status, 'issued')
})

test('invoice headers include item adjustments and invoice adjustments once', () => {
  const items = [{ type: 'room_charge', quantity: 1, unit_price: 100, discount_amount: 10, tax_amount: 14 }]
  assert.equal(mapInvoiceItemsForInsert('invoice', items)[0].total_price, 104)
  assert.deepEqual(calculateInvoiceTotals({ items }), { subtotal: 100, discount: 10, taxAmount: 14, serviceCharge: 0, total: 104 })
  assert.equal(calculateInvoiceTotals({ items, discount: 5, tax_amount: 2, service_charge: 3 }).total, 104)
})

test('receipt input rejects refunds, zero and nonfinite amounts', () => {
  const receipt = { invoice_id: '00000000-0000-4000-8000-000000000001', method: 'cash', currency: 'EGP' }
  for (const amount of [-100, 0, Infinity, NaN, 0.001, 10000000000]) assert.equal(AccountingPaymentCreateSchema.safeParse({ ...receipt, amount }).success, false)
  assert.equal(AccountingPaymentCreateSchema.safeParse({ ...receipt, amount: 100 }).success, true)
})

test('refund status preserves gross receipt settlement independently of cash returned', () => {
  assert.equal(deriveInvoiceStatus({ invoiceTotal: 100, grossPaid: 100, totalRefunded: 40, currentStatus: 'paid' }), 'partially_refunded')
  assert.equal(deriveInvoiceStatus({ invoiceTotal: 100, grossPaid: 100, totalRefunded: 100, currentStatus: 'paid' }), 'refunded')
})

test('expenses never cross currencies or silently classify unknown historical money', () => {
  const result = subtractMoney(toMoney([{ amount: 100, currency: 'USD' }]), toMoney([{ amount: 20, currency: 'EGP' }, { amount: 5, currency: 'UNKNOWN' }]))
  assert.deepEqual(result, [{ currency: 'USD', amount: 100 }, { currency: 'EGP', amount: -20 }, { currency: 'UNKNOWN', amount: -5 }])
})
