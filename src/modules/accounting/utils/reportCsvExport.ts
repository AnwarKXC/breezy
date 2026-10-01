import { toMoney, type Money } from '@/shared/currency/money'
import type { DailyRevenueReport, MonthlyRevenueReport, AccountsReceivableAging, ReportInvoiceDetail, ReportExpenseDetail } from '../types'

function downloadCsv(headers: string[], rows: string[][], fileName: string): void {
  const bom = '\uFEFF'
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${(/^[\s\u0000-\u001f]*[=+@-]/.test(String(cell)) ? `'${cell}` : String(cell)).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')

  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** One `[label, currency, amount]` row per currency; amounts are never converted. */
function moneyRows(label: string, value: Money, fallback: string): string[][] {
  return value.length === 0 ? [[label, fallback, '0']] : value.map((m) => [label, m.currency || fallback, String(m.amount)])
}

function allRows(invoices: ReportInvoiceDetail[], expenses: ReportExpenseDetail[]): string[][] {
  const inv = invoices.map((i) => [
    'Invoice', i.invoiceNumber,
    i.guestName ?? i.companyName ?? '',
    i.roomNumber ?? '',
    i.currency,
    String(i.amount), String(i.paidAmount), String(i.refundedAmount), String(i.remainingBalance),
    i.paymentMethod ?? '', i.status, i.issueDate?.slice(0, 10) ?? '',
  ])
  const exp = expenses.map((e) => [
    'Expense', e.description,
    e.categoryName ?? '', '',
    e.currency ?? 'UNRESOLVED',
    String(e.totalAmount), String(e.status === 'paid' ? e.totalAmount : 0), '0', String(e.status === 'approved' ? e.totalAmount : 0),
    e.paymentMethod ?? '', e.status, e.date?.slice(0, 10) ?? '',
  ])
  return [...inv, ...exp].sort((a, b) => a[11].localeCompare(b[11])).reverse()
}

function downloadReportsCsv(report: DailyRevenueReport | MonthlyRevenueReport, prefix: string, systemCurrency: string): void {
  const isDaily = 'date' in report
  const periodLabel = isDaily ? (report as DailyRevenueReport).date : (report as MonthlyRevenueReport).month
  const inv = isDaily ? (report as DailyRevenueReport).invoices : (report as MonthlyRevenueReport).invoices
  const exp = isDaily ? (report as DailyRevenueReport).expenseDetails : (report as MonthlyRevenueReport).expenseDetails
  const totalRevenue = isDaily ? (report as DailyRevenueReport).totalRevenue : (report as MonthlyRevenueReport).totalRevenue
  const totalExpenses = isDaily ? (report as DailyRevenueReport).expenses : (report as MonthlyRevenueReport).expenses

  downloadCsv(
    ['Type', 'ID/Description', 'Details', 'Room', 'Currency', 'Amount', 'Paid', 'Refunded', 'Remaining', 'Method', 'Status', 'Date'],
    allRows(inv, exp),
    `${prefix}-records-${periodLabel}.csv`,
  )

  const invoiceTotal = (value: (i: ReportInvoiceDetail) => number) => toMoney(inv.map((i) => ({ amount: value(i), currency: i.currency })))

  downloadCsv(
    ['Metric', 'Currency', 'Value'],
    [
      ['Period', '', periodLabel],
      ...(exp.some((expense) => !expense.currency) ? [['Warning', '', 'Historical expenses with unresolved currency remain unclassified; reconcile before relying on profit figures.']] : []),
      ...moneyRows('Total Revenue', totalRevenue, systemCurrency),
      ...moneyRows('Total Paid', invoiceTotal((i) => i.paidAmount), systemCurrency),
      ...moneyRows('Total Refunded', invoiceTotal((i) => i.refundedAmount), systemCurrency),
      ...moneyRows('Total Remaining', invoiceTotal((i) => i.remainingBalance), systemCurrency),
      ...moneyRows('Total Expenses', totalExpenses, systemCurrency),
    ],
    `${prefix}-summary-${periodLabel}.csv`,
  )
}

export function exportDailyRevenueCsv(report: DailyRevenueReport, systemCurrency: string): void {
  downloadReportsCsv(report, 'daily-revenue', systemCurrency)
}

export function exportMonthlyRevenueCsv(report: MonthlyRevenueReport, systemCurrency: string): void {
  downloadReportsCsv(report, 'monthly-revenue', systemCurrency)
}

export function exportAgingCsv(report: AccountsReceivableAging, fileName: string, systemCurrency: string): void {
  const headers = ['Aging Bucket', 'Currency', 'Amount']
  const rows = [
    ...moneyRows('Current', report.current, systemCurrency),
    ...moneyRows('1-30 Days', report.days1to30, systemCurrency),
    ...moneyRows('31-60 Days', report.days31to60, systemCurrency),
    ...moneyRows('61+ Days', report.days61plus, systemCurrency),
    ...moneyRows('Total', report.total, systemCurrency),
  ]
  downloadCsv(headers, rows, fileName)
}
