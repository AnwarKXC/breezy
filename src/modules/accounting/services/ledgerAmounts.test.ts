import { describe, expect, it } from 'vitest'
import { getPaymentLedgerEntryAmounts, getExpenseLedgerEntryAmounts } from './ledgerAmounts'

describe('getPaymentLedgerEntryAmounts', () => {
  it('records a positive payment as INCOME (cash in)', () => {
    expect(getPaymentLedgerEntryAmounts(1000)).toEqual({ incomeAmount: 1000, outcomeAmount: 0 })
  })

  it('records a refund (negative payment) as OUTCOME (cash out)', () => {
    expect(getPaymentLedgerEntryAmounts(-300)).toEqual({ incomeAmount: 0, outcomeAmount: 300 })
  })

  it('returns zeroed sides for a zero amount', () => {
    expect(getPaymentLedgerEntryAmounts(0)).toEqual({ incomeAmount: 0, outcomeAmount: 0 })
  })

  it('treats non-numeric input as zero', () => {
    expect(getPaymentLedgerEntryAmounts(NaN as unknown as number)).toEqual({ incomeAmount: 0, outcomeAmount: 0 })
  })

  it('uses the absolute refund value regardless of sign magnitude', () => {
    expect(getPaymentLedgerEntryAmounts(-1000.5)).toEqual({ incomeAmount: 0, outcomeAmount: 1000.5 })
  })

  it('never books the same amount on both sides (no duplicate)', () => {
    const entry = getPaymentLedgerEntryAmounts(1000)
    expect(entry.incomeAmount).toBe(1000)
    expect(entry.outcomeAmount).toBe(0)
  })
})

describe('getExpenseLedgerEntryAmounts', () => {
  it('books the expense total (net + tax) as outcome', () => {
    expect(getExpenseLedgerEntryAmounts(800, 200)).toEqual({ incomeAmount: 0, outcomeAmount: 1000 })
  })

  it('falls back to the net amount when tax is missing', () => {
    expect(getExpenseLedgerEntryAmounts(500, 0)).toEqual({ incomeAmount: 0, outcomeAmount: 500 })
  })

  it('never books a negative outcome', () => {
    expect(getExpenseLedgerEntryAmounts(-50, 10)).toEqual({ incomeAmount: 0, outcomeAmount: 0 })
  })
})
