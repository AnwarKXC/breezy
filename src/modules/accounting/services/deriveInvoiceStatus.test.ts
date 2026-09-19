import { describe, expect, it } from 'vitest'
import { deriveInvoiceStatus, deriveRemainingBalance } from './deriveInvoiceStatus'

describe('deriveInvoiceStatus', () => {
  it('returns void/cancelled unchanged (terminal preservation)', () => {
    expect(deriveInvoiceStatus({
      invoiceTotal: 1000, grossPaid: 1000, totalRefunded: 0, currentStatus: 'void',
    })).toBe('void')
    expect(deriveInvoiceStatus({
      invoiceTotal: 1000, grossPaid: 1000, totalRefunded: 200, currentStatus: 'cancelled',
    })).toBe('cancelled')
  })

  it('marks a paid invoice with zero refunds as paid', () => {
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 2000, totalRefunded: 0, currentStatus: 'issued',
    })).toBe('paid')
  })

  it('marks a partial refund (200 of 2000) as partially_refunded — THE BUG FIX', () => {
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 2000, totalRefunded: 200, currentStatus: 'paid',
    })).toBe('partially_refunded')
  })

  it('marks multiple cumulative partial refunds as partially_refunded', () => {
    // Refund 1: 200, Refund 2: 300, Refund 3: 500 -> 1000 of 2000
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 2000, totalRefunded: 500, currentStatus: 'partially_refunded',
    })).toBe('partially_refunded')
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 2000, totalRefunded: 999.99, currentStatus: 'partially_refunded',
    })).toBe('partially_refunded')
  })

  it('marks a full cumulative refund as refunded', () => {
    // After Refund 3: 1500 added to 500 -> 2000 total = grossPaid
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 2000, totalRefunded: 2000, currentStatus: 'partially_refunded',
    })).toBe('refunded')
  })

  it('marks refunded when totalRefunded exceeds grossPaid (defensive)', () => {
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 2000, totalRefunded: 2100, currentStatus: 'paid',
    })).toBe('refunded')
  })

  it('partial refund on a partially-paid invoice yields partially_refunded', () => {
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 1000, totalRefunded: 200, currentStatus: 'partially_paid',
    })).toBe('partially_refunded')
  })

  it('no payments and no refunds on a non-draft invoice returns issued', () => {
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 0, totalRefunded: 0, currentStatus: 'issued',
    })).toBe('issued')
  })

  it('draft with no payments stays draft', () => {
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 0, totalRefunded: 0, currentStatus: 'draft',
    })).toBe('draft')
  })

  it('overdue without refunds but partial payment returns partially_paid', () => {
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 1000, totalRefunded: 0, currentStatus: 'overdue',
    })).toBe('partially_paid')
  })

  it('overdue fully paid returns paid', () => {
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 2000, totalRefunded: 0, currentStatus: 'overdue',
    })).toBe('paid')
  })

  it('does not flip refunded -> paid on a refund rollback (caller responsibility)', () => {
    // After a refund is reversed, currentStatus='partially_refunded' with
    // totalRefunded=0 should fall through to the paid/partially_paid branch.
    expect(deriveInvoiceStatus({
      invoiceTotal: 2000, grossPaid: 2000, totalRefunded: 0, currentStatus: 'partially_refunded',
    })).toBe('paid')
  })
})

describe('deriveRemainingBalance', () => {
  it('returns zero when gross paid equals total', () => {
    expect(deriveRemainingBalance({ invoiceTotal: 2000, grossPaid: 2000, totalRefunded: 0 })).toBe(0)
  })

  it('returns total - gross_paid for a partial payment (refunds ignored)', () => {
    expect(deriveRemainingBalance({ invoiceTotal: 2000, grossPaid: 1500, totalRefunded: 0 })).toBe(500)
  })

  it('never goes negative for overpayment', () => {
    expect(deriveRemainingBalance({ invoiceTotal: 1000, grossPaid: 2000, totalRefunded: 0 })).toBe(0)
  })

  it('balance stays 0 after a partial refund on a fully paid invoice — THE BUG FIX', () => {
    // 2000 paid in full, 200 refunded → balance_due stays 0 (customer owes
    // nothing new; the merchant owes the customer the 200 refund, tracked
    // separately via refunded_amount / net_paid)
    expect(deriveRemainingBalance({ invoiceTotal: 2000, grossPaid: 2000, totalRefunded: 200 })).toBe(0)
  })

  it('balance stays 0 after a full refund on a fully paid invoice', () => {
    expect(deriveRemainingBalance({ invoiceTotal: 2000, grossPaid: 2000, totalRefunded: 2000 })).toBe(0)
  })

  it('balance reflects only the missing payment, not refunds, when partially paid then partially refunded', () => {
    // total 2000, paid 1000, refunded 200 → still owe 1000 (not 1200)
    expect(deriveRemainingBalance({ invoiceTotal: 2000, grossPaid: 1000, totalRefunded: 200 })).toBe(1000)
  })
})