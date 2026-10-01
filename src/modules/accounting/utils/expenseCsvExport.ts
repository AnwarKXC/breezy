import type { Expense } from '../types'
import { expenseTotals } from './expenseMoney'

function cell(value: string | number) {
  const text = String(value)
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export async function exportExpensesCsv(expenses: Expense[], categoryNames: Record<string, string>, fileName: string): Promise<void> {
  const rows: (string | number)[][] = [
    ['Date', 'Category', 'Description', 'Currency', 'Net', 'Tax', 'Total', 'Status'],
    ...expenses.map((expense) => [expense.date, categoryNames[expense.categoryId] ?? expense.categoryId,
      expense.description, expense.currency ?? 'UNRESOLVED', expense.amount, expense.taxAmount,
      expense.totalAmount, expense.status]),
    [],
    ['Totals by original currency; unresolved amounts must be reconciled'],
    ...expenseTotals(expenses).map((total) => ['Total', '', '', total.currency, '', '', total.amount, '']),
  ]
  const blob = new Blob(['\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.replace(/\.xlsx$/, '.csv')
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
