import { toMoney } from '@/shared/currency/money'

type ExpenseAmount = { currency: string | null; totalAmount: number; amount?: number }

/** Unknown historical currencies remain visibly separate from every known currency. */
export function expenseTotals(expenses: ExpenseAmount[]) {
  return toMoney(expenses.map((expense) => ({ amount: expense.totalAmount, currency: expense.currency ?? 'UNKNOWN' })))
}

export function formatExpenseAmount(amount: number, currency: string | null) {
  return currency && currency !== 'UNKNOWN'
    ? new Intl.NumberFormat('en', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount)
    : `${amount.toFixed(2)} (currency unresolved)`
}

export function formatExpenseTotals(totals: ReturnType<typeof expenseTotals>) {
  return totals.length ? totals.map((entry) => formatExpenseAmount(entry.amount, entry.currency)).join(' · ') : '0'
}
