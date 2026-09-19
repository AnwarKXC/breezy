import { formatDate } from '@/shared/utils/date'
import type { Expense } from '../types'
import { buildAndDownloadPdf } from '@/shared/utils/pdfMake'
import type { Locale } from '@/i18n/config'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

export async function exportExpensesListPdf(expenses: Expense[], categoryNames: Record<string, string>, locale: Locale, fileName: string): Promise<void> {
  const rows = expenses.map((exp) => [
    categoryNames[exp.categoryId] ?? exp.categoryId,
    exp.description,
    formatCurrency(exp.totalAmount),
    exp.vendor ?? '',
    exp.costCenter ?? '',
    exp.status,
    formatDate(exp.date, locale),
  ])

  await buildAndDownloadPdf({
    title: 'Expenses Report',
    headers: ['Category', 'Description', 'Total', 'Vendor', 'Cost Center', 'Status', 'Date'],
    rows,
    locale,
    fileName,
  })
}
