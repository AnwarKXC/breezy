export interface LedgerSideAmounts {
  incomeAmount: number
  outcomeAmount: number
}

// Double-entry rule for payment ledger entries:
// - A positive payment is cash IN → recorded on the INCOME side.
// - A negative payment is a refund (cash OUT) → recorded on the OUTCOME side.
export function getPaymentLedgerEntryAmounts(amount: number): LedgerSideAmounts {
  const value = Number(amount) || 0
  if (value < 0) return { incomeAmount: 0, outcomeAmount: Math.abs(value) }
  return { incomeAmount: value, outcomeAmount: 0 }
}

// Expense ledger entries are always a cost → outcome side. Total = amount + tax.
export function getExpenseLedgerEntryAmounts(netAmount: number, taxAmount: number): LedgerSideAmounts {
  const total = Math.max(0, (Number(netAmount) || 0) + (Number(taxAmount) || 0))
  return { incomeAmount: 0, outcomeAmount: total }
}
