import { buildAndDownloadPdf } from '@/shared/utils/pdfMake'
import type { PdfSection } from '@/shared/utils/pdfMake'
import type { Locale } from '@/i18n/config'
import { toMoney, type Money } from '@/shared/currency/money'
import type { DailyRevenueReport, MonthlyRevenueReport, AccountsReceivableAging, ReportInvoiceDetail, ReportExpenseDetail } from '../types'
import { formatExpenseAmount } from './expenseMoney'

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

/** One figure per currency (`EGP 10,000 · $500`); PDFs never convert between currencies. */
function formatMoney(value: Money, fallback: string): string {
  return value.length === 0 ? formatCurrency(0, fallback) : value.map((m) => formatExpenseAmount(m.amount, m.currency || null)).join(' · ')
}

function combinedRows(invoices: ReportInvoiceDetail[], expenses: ReportExpenseDetail[]): string[][] {
  const inv = invoices.map((i) => [
    'Invoice', i.invoiceNumber,
    i.guestName ?? i.companyName ?? '—',
    formatCurrency(i.amount, i.currency), formatCurrency(i.paidAmount, i.currency),
    i.refundedAmount > 0 ? formatCurrency(i.refundedAmount, i.currency) : '—',
    formatCurrency(i.remainingBalance, i.currency),
    i.paymentMethod ?? '—', i.status, i.issueDate?.slice(0, 10) ?? '—',
  ])
  const exp = expenses.map((e) => [
    'Expense', e.description,
    e.categoryName ?? '—',
    formatExpenseAmount(e.totalAmount, e.currency), formatExpenseAmount(e.status === 'paid' ? e.totalAmount : 0, e.currency),
    '—', formatExpenseAmount(e.status === 'approved' ? e.totalAmount : 0, e.currency),
    e.paymentMethod ?? '—', e.status, e.date?.slice(0, 10) ?? '—',
  ])
  return [...inv, ...exp].sort((a, b) => a[9].localeCompare(b[9])).reverse()
}

function buildSections(report: { totalRevenue: Money; expenses: Money }, invoices: ReportInvoiceDetail[], expenses: ReportExpenseDetail[], summaryRows: string[][], mainTitle: string, currency: string): PdfSection[] {
  const invoiceTotal = (value: (i: ReportInvoiceDetail) => number) => toMoney(invoices.map((i) => ({ amount: value(i), currency: i.currency })))
  const totalPaid = invoiceTotal((i) => i.paidAmount)
  const totalRefunded = invoiceTotal((i) => i.refundedAmount)
  const totalRemaining = invoiceTotal((i) => i.remainingBalance)

  const sections: PdfSection[] = [
    { title: mainTitle, headers: ['Metric', 'Value'], rows: summaryRows },
  ]
  if (expenses.some((expense) => !expense.currency)) sections.push({
    title: 'Reconciliation required', headers: ['Warning'],
    rows: [['Historical expenses with unresolved currency remain unclassified. Reconcile before relying on profit figures.']],
  })

  if (invoices.length > 0 || expenses.length > 0) {
    sections.push({
      title: `All Records (${invoices.length + expenses.length})`,
      headers: ['Type', 'ID/Description', 'Details', 'Amount', 'Paid', 'Refunded', 'Remaining', 'Method', 'Status', 'Date'],
      rows: combinedRows(invoices, expenses),
    })
    sections.push({
      title: 'Summary Totals',
      headers: ['Metric', 'Value'],
      rows: [
        ['Total Revenue', formatMoney(report.totalRevenue, currency)],
        ['Total Paid', formatMoney(totalPaid, currency)],
        ['Total Refunded', formatMoney(totalRefunded, currency)],
        ['Total Remaining', formatMoney(totalRemaining, currency)],
        ['Total Expenses', formatMoney(report.expenses, currency)],
      ],
    })
  }

  return sections
}

export async function exportDailyRevenuePdf(report: DailyRevenueReport, locale: Locale, fileName: string, currency: string): Promise<void> {
  const summaryRows = [
    ['Room Revenue', formatMoney(report.roomRevenue, currency)],
    ['Extra Services', formatMoney(report.extraServices, currency)],
    ['Tax Collected', formatMoney(report.taxCollected, currency)],
    ['Total Revenue', formatMoney(report.totalRevenue, currency)],
    ['Expenses', formatMoney(report.expenses, currency)],
    ['Net Revenue', formatMoney(report.netRevenue, currency)],
    ['Occupancy Count', String(report.occupancyCount)],
    ...report.payments.map((p) => [`Payment: ${p.method}`, formatMoney(p.amount, currency)]),
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
    ['Room Revenue', formatMoney(report.roomRevenue, currency)],
    ['Other Revenue', formatMoney(report.otherRevenue, currency)],
    ['Total Revenue', formatMoney(report.totalRevenue, currency)],
    ['Expenses', formatMoney(report.expenses, currency)],
    ['Net Profit', formatMoney(report.netProfit, currency)],
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
    ['Current', formatMoney(report.current, currency)],
    ['1-30 Days', formatMoney(report.days1to30, currency)],
    ['31-60 Days', formatMoney(report.days31to60, currency)],
    ['61+ Days', formatMoney(report.days61plus, currency)],
    ['Total', formatMoney(report.total, currency)],
  ]
  await buildAndDownloadPdf({
    title: 'Accounts Receivable Aging',
    headers: ['Aging Bucket', 'Amount'],
    rows,
    locale,
    fileName,
  })
}
