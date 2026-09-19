import type { DailyRevenueReport, MonthlyRevenueReport, AccountsReceivableAging, ReportInvoiceDetail, ReportExpenseDetail } from '../types'

function downloadCsv(headers: string[], rows: string[][], fileName: string): void {
  const bom = '\uFEFF'
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
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

function allRows(invoices: ReportInvoiceDetail[], expenses: ReportExpenseDetail[]): string[][] {
  const inv = invoices.map((i) => [
    'Invoice', i.invoiceNumber,
    i.guestName ?? i.companyName ?? '',
    i.roomNumber ?? '',
    String(i.amount), String(i.paidAmount), String(i.refundedAmount), String(i.remainingBalance),
    i.paymentMethod ?? '', i.status, i.issueDate?.slice(0, 10) ?? '',
  ])
  const exp = expenses.map((e) => [
    'Expense', e.description,
    e.categoryName ?? '', '',
    String(e.totalAmount), String(e.totalAmount), '0', '0',
    e.paymentMethod ?? '', e.status, e.date?.slice(0, 10) ?? '',
  ])
  return [...inv, ...exp].sort((a, b) => a[10].localeCompare(b[10])).reverse()
}

function downloadReportsCsv(report: DailyRevenueReport | MonthlyRevenueReport, prefix: string): void {
  const isDaily = 'date' in report
  const periodLabel = isDaily ? (report as DailyRevenueReport).date : (report as MonthlyRevenueReport).month
  const inv = isDaily ? (report as DailyRevenueReport).invoices : (report as MonthlyRevenueReport).invoices
  const exp = isDaily ? (report as DailyRevenueReport).expenseDetails : (report as MonthlyRevenueReport).expenseDetails
  const totalRevenue = isDaily ? (report as DailyRevenueReport).totalRevenue : (report as MonthlyRevenueReport).totalRevenue
  const totalExpenses = isDaily ? (report as DailyRevenueReport).expenses : (report as MonthlyRevenueReport).expenses

  downloadCsv(
    ['Type', 'ID/Description', 'Details', 'Room', 'Amount', 'Paid', 'Refunded', 'Remaining', 'Method', 'Status', 'Date'],
    allRows(inv, exp),
    `${prefix}-records-${periodLabel}.csv`,
  )

  const totalPaid = inv.reduce((s, i) => s + i.paidAmount, 0)
  const totalRefunded = inv.reduce((s, i) => s + i.refundedAmount, 0)
  const totalRemaining = inv.reduce((s, i) => s + i.remainingBalance, 0)

  downloadCsv(
    ['Metric', 'Value'],
    [
      ['Period', periodLabel],
      ['Total Revenue', String(totalRevenue)],
      ['Total Paid', String(totalPaid)],
      ['Total Refunded', String(totalRefunded)],
      ['Total Remaining', String(totalRemaining)],
      ['Total Expenses', String(totalExpenses)],
    ],
    `${prefix}-summary-${periodLabel}.csv`,
  )
}

export function exportDailyRevenueCsv(report: DailyRevenueReport, fileName: string): void {
  downloadReportsCsv(report, 'daily-revenue')
}

export function exportMonthlyRevenueCsv(report: MonthlyRevenueReport, fileName: string): void {
  downloadReportsCsv(report, 'monthly-revenue')
}

export function exportAgingCsv(report: AccountsReceivableAging, fileName: string): void {
  const headers = ['Aging Bucket', 'Amount']
  const rows = [
    ['Current', String(report.current)],
    ['1-30 Days', String(report.days1to30)],
    ['31-60 Days', String(report.days31to60)],
    ['61+ Days', String(report.days61plus)],
    ['Total', String(report.total)],
  ]
  downloadCsv(headers, rows, fileName)
}
