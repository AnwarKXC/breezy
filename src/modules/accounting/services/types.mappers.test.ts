import { describe, expect, it } from 'vitest'
import { mapPaymentRow, mapLedgerEntryRow } from '../types'

describe('mapPaymentRow', () => {
  it('maps the invoice number from the joined invoices relation', () => {
    const row = {
      id: 'pay-1',
      invoice_id: 'inv-1',
      type: 'cash',
      amount: 1000,
      description: null,
      created_by: 'u-1',
      created_at: '2026-08-01T10:00:00Z',
      updated_at: null,
      invoices: { contact_id: 'c-1', invoice_number: 'INV-2026-0001' },
    }

    const payment = mapPaymentRow(row as never)

    expect(payment.invoiceId).toBe('inv-1')
    expect(payment.invoiceNumber).toBe('INV-2026-0001')
  })

  it('falls back to null when the join is absent (plain payment row)', () => {
    const row = {
      id: 'pay-1',
      invoice_id: 'inv-1',
      type: 'cash',
      amount: 1000,
      description: null,
      created_by: 'u-1',
      created_at: null,
      updated_at: null,
    }

    const payment = mapPaymentRow(row as never)

    expect(payment.invoiceNumber).toBeNull()
    expect(payment.amount).toBe(1000)
  })
})

describe('mapLedgerEntryRow', () => {
  const baseRow = {
    id: 'le-1',
    transaction_number: 'TXN-1',
    type: 'revenue',
    source_type: 'invoice',
    source_id: 'inv-1',
    invoice_id: 'inv-1',
    income_amount: 0,
    outcome_amount: 1000,
    currency: 'USD',
    account_category: null,
    description: 'Invoice INV-2026-0001',
    transaction_date: '2026-08-01',
    created_by: 'u-1',
    metadata: null,
    reversal_of_transaction_id: null,
    created_at: '2026-08-01T10:00:00Z',
  }

  it('maps invoiceId and the joined invoice number', () => {
    const entry = mapLedgerEntryRow({
      ...baseRow,
      invoices: { invoice_number: 'INV-2026-0001' },
    } as never)

    expect(entry.invoiceId).toBe('inv-1')
    expect(entry.invoiceNumber).toBe('INV-2026-0001')
  })

  it('tolerates a missing invoice join', () => {
    const entry = mapLedgerEntryRow(baseRow as never)

    expect(entry.invoiceId).toBe('inv-1')
    expect(entry.invoiceNumber).toBeNull()
  })

  it('maps income and outcome sides', () => {
    const entry = mapLedgerEntryRow(baseRow as never)

    expect(entry.incomeAmount).toBe(0)
    expect(entry.outcomeAmount).toBe(1000)
  })
})