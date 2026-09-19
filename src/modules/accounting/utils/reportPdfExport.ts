import { buildAndDownloadPdf } from '@/shared/utils/pdfMake'
import type { PdfSection } from '@/shared/utils/pdfMake'
import type { Locale } from '@/i18n/config'
import type { DailyRevenueReport, MonthlyRevenueReport, AccountsReceivableAging, ReportInvoiceDetail, ReportExpenseDetail } from '../types'

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

function combinedRows(invoices: ReportInvoiceDetail[], expenses: ReportExpenseDetail[], currency: string): string[][] {
  const inv = invoices.map((i) => [
    'Invoice', i.invoiceNumber,
    i.guestName ?? i.companyName ?? '—',
    formatCurrency(i.amount, currency), formatCurrency(i.paidAmount, currency),
    i.refundedAmount > 0 ? formatCurrency(i.refundedAmount, currency) : '—',
    formatCurrency(i.remainingBalance, currency),
    i.paymentMethod ?? '—', i.status, i.issueDate?.slice(0, 10) ?? '—',
  ])
  const exp = expenses.map((e) => [
    'Expense', e.description,
    e.categoryName ?? '—',
    formatCurrency(e.totalAmount, currency), formatCurrency(e.totalAmount, currency),
    '—', '0',
    e.paymentMethod ?? '—', e.status, e.date?.slice(0, 10) ?? '—',
  ])
  return [...inv, ...exp].sort((a, b) => a[9].localeCompare(b[9])).reverse()
}

function buildSections(report: { totalRevenue: number; expenses: number }, invoices: ReportInvoiceDetail[], expenses: ReportExpenseDetail[], summaryRows: string[][], mainTitle: string, currency: string): PdfSection[] {
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0)
  const totalRefunded = invoices.reduce((s, i) => s + i.refundedAmount, 0)
  const totalRemaining = invoices.reduce((s, i) => s + i.remainingBalance, 0)

  const sections: PdfSection[] = [
    { title: mainTitle, headers: ['Metric', 'Value'], rows: summaryRows },
  ]

  if (invoices.length > 0 || expenses.length > 0) {
    sections.push({
      title: `All Records (${invoices.length + expenses.length})`,
      headers: ['Type', 'ID/Description', 'Details', 'Amount', 'Paid', 'Refunded', 'Remaining', 'Method', 'Status', 'Date'],
      rows: combinedRows(invoices, expenses, currency),
    })
    sections.push({
      title: 'Summary Totals',
      headers: ['Metric', 'Value'],
      rows: [
        ['Total Revenue', formatCurrency(report.totalRevenue, currency)],
        ['Total Paid', formatCurrency(totalPaid, currency)],
        ['Total Refunded', formatCurrency(totalRefunded, currency)],
        ['Total Remaining', formatCurrency(totalRemaining, currency)],
        ['Total Expenses', formatCurrency(report.expenses, currency)],
      ],
    })
  }

  return sections
}

export async function exportDailyRevenuePdf(report: DailyRevenueReport, locale: Locale, fileName: string, currency: string): Promise<void> {
  const summaryRows = [
    ['Room Revenue', formatCurrency(report.roomRevenue, currency)],
    ['Extra Services', formatCurrency(report.extraServices, currency)],
    ['Tax Collected', formatCurrency(report.taxCollected, currency)],
    ['Total Revenue', formatCurrency(report.totalRevenue, currency)],
    ['Expenses', formatCurrency(report.expenses, currency)],
    ['Net Revenue', formatCurrency(report.netRevenue, currency)],
    ['Occupancy Count', String(report.occupancyCount)],
    ...report.payments.map((p) => [`Payment: ${p.method}`, formatCurrency(p.amount, currency)]),
  ]

  await buildAndDownloadPdf({
    title: `Daily Revenue Report - ${report.date}`,
    sections: buildSections(report, report.invoices, report.expenseDetails, summaryRows, 'Summary Metrics', currency),
    locale,
    fileName,
  })
}

export async function exportMonthlyRevenuePdf(report: MonthlyRevenueReport, locale: Locale, fileName: string, currency: string): Promise<void> {
  const summaryRows = [
    ['Room Revenue', formatCurrency(report.roomRevenue, currency)],
    ['Other Revenue', formatCurrency(report.otherRevenue, currency)],
    ['Total Revenue', formatCurrency(report.totalRevenue, currency)],
    ['Expenses', formatCurrency(report.expenses, currency)],
    ['Net Profit', formatCurrency(report.netProfit, currency)],
    ['Occupancy Rate', `${report.occupancyRate.toFixed(1)}%`],
    ['Average Daily Rate', formatCurrency(report.averageDailyRate, currency)],
  ]

  await buildAndDownloadPdf({
    title: `Monthly Revenue Report - ${report.month}`,
    sections: buildSections(report, report.invoices, report.expenseDetails, summaryRows, 'Summary Metrics', currency),
    locale,
    fileName,
  })
}

export async function exportAgingPdf(report: AccountsReceivableAging, locale: Locale, fileName: string, currency: string): Promise<void> {
  const rows = [
    ['Current', formatCurrency(report.current, currency)],
    ['1-30 Days', formatCurrency(report.days1to30, currency)],
    ['31-60 Days', formatCurrency(report.days31to60, currency)],
    ['61+ Days', formatCurrency(report.days61plus, currency)],
    ['Total', formatCurrency(report.total, currency)],
  ]
  await buildAndDownloadPdf({
    title: 'Accounts Receivable Aging',
    headers: ['Aging Bucket', 'Amount'],
    rows,
    locale,
    fileName,
  })
}
