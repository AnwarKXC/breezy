'use client'

import { useState, useCallback, useMemo, type ReactNode } from 'react'
import { fetchData, useResource } from '@/shared/data/useResource'
import { Skeleton } from '@/shared/components/Skeleton'
import { ToolbarExportGroup } from '@/shared/components/toolbar'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { isNonNegativeMoney, toMoney } from '@/shared/currency/money'
import { useLocale } from '@/i18n/components/LocaleContext'
import { formatDate } from '@/shared/utils/date'
import type { DailyRevenueReport, MonthlyRevenueReport, ReportInvoiceDetail, ReportExpenseDetail } from '../types'
import { exportDailyRevenueCsv, exportMonthlyRevenueCsv } from '../utils/reportCsvExport'
import { exportDailyRevenuePdf, exportMonthlyRevenuePdf } from '../utils/reportPdfExport'
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../types'
import { formatExpenseAmount } from '../utils/expenseMoney'
import { MoneyTotals } from '@/shared/components/MoneyTotals'
import { MoneyAmount } from '@/shared/components/MoneyTotals'

interface Props {
  t: (key: string) => string
}

type RecordType = 'invoice' | 'expense'

interface CombinedRow {
  id: string
  type: RecordType
  invoiceNumber?: string
  description: string
  secondary: string
  amount: number
  currency: string | null
  paidAmount: number
  refundedAmount: number
  remainingBalance: number
  totalAmount: number
  taxAmount: number
  vendor: string | null
  category: string | null
  costCenter: string | null
  room: string | null
  method: string | null
  status: string
  date: string
}

const PAGE_SIZE = 20

const cardClass = 'rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-1'
const tableHeadClass = 'text-left text-xs font-medium text-[#787774] uppercase tracking-wider px-3 py-2 bg-[#F9F9F9] border-b border-[#EAEAEA]'
const tableCellClass = 'px-3 py-2 text-sm text-[#333333] border-b border-[#EAEAEA]'

function MetricCard({ label, value, context, positive }: {
  label: string; value: ReactNode; context?: string; positive?: boolean
}) {
  return (
    <div className={cardClass}>
      <p className="text-sm text-[#787774]">{label}</p>
      <p className={`break-words text-2xl font-bold ${positive === true ? 'text-green-600' : positive === false ? 'text-[#9F2F2D]' : 'text-[#1A1A1A]'}`}>{value}</p>
      {context && <p className="text-xs text-[#BBBBBB]">{context}</p>}
    </div>
  )
}

function TypeBadge({ type, t }: { type: RecordType; t: (key: string) => string }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${
      type === 'invoice'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-orange-50 text-orange-700 border-orange-200'
    }`}>
      {type === 'invoice' ? t('accounting.reports.invoiceBadge') : t('accounting.reports.expenseBadge')}
    </span>
  )
}

function StatusBadge({ status, type }: { status: string; type: RecordType }) {
  if (type === 'expense') {
    const colors: Record<string, string> = {
      paid: 'bg-green-50 text-green-700 border-green-200',
      approved: 'bg-blue-50 text-blue-700 border-blue-200',
      draft: 'bg-gray-50 text-gray-500 border-gray-200',
      void: 'bg-gray-50 text-gray-400 border-gray-200',
    }
    return (
      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${colors[status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }
  const colors: Record<string, string> = {
    paid: 'bg-green-50 text-green-700 border-green-200',
    partially_paid: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    issued: 'bg-blue-50 text-blue-700 border-blue-200',
    overdue: 'bg-red-50 text-red-700 border-red-200',
    draft: 'bg-gray-50 text-gray-500 border-gray-200',
    void: 'bg-gray-50 text-gray-400 border-gray-200',
    refunded: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full border ${colors[status] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {INVOICE_STATUS_LABELS[status] ?? status}
    </span>
  )
}

function Pagination({ page, totalPages, onPrev, onNext, from, to, total, t }: {
  page: number; totalPages: number; onPrev: () => void; onNext: () => void; from: number; to: number; total: number; t: (key: string) => string
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-3 text-sm text-[#787774]">
      <span>{from + 1}–{Math.min(to, total)} of {total}</span>
      <div className="flex gap-1">
        <button onClick={onPrev} disabled={page <= 0}
          className="px-3 py-1 rounded border border-[#D4D4D4] disabled:opacity-30 hover:bg-accent/10"
        >{t('common.previous')}</button>
        <button onClick={onNext} disabled={page >= totalPages - 1}
          className="px-3 py-1 rounded border border-[#D4D4D4] disabled:opacity-30 hover:bg-accent/10"
        >{t('common.next')}</button>
      </div>
    </div>
  )
}

function CombinedTable({ rows, page, totalPages, onPrev, onNext, onDownloadInvoice, printingId, t }: {
  rows: CombinedRow[]; page: number; totalPages: number; onPrev: () => void; onNext: () => void; onDownloadInvoice?: (id: string) => void; printingId?: string | null; t: (key: string) => string
}) {
  if (rows.length === 0) return <p className="text-sm text-[#787774] py-4">{t('accounting.reports.noRecords')}</p>
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th className={tableHeadClass}>{t('accounting.ledger.type')}</th>
              <th className={tableHeadClass}>{t('accounting.reports.idDescription')}</th>
              <th className={tableHeadClass}>{t('accounting.reports.details')}</th>
              <th className={tableHeadClass}>{t('accounting.invoices.amount')}</th>
              <th className={tableHeadClass}>{t('accounting.reports.paid')}</th>
              <th className={tableHeadClass}>{t('accounting.reports.refunded')}</th>
              <th className={tableHeadClass}>{t('accounting.reports.remaining')}</th>
              <th className={tableHeadClass}>{t('accounting.reports.method')}</th>
              <th className={tableHeadClass}>{t('accounting.invoices.status')}</th>
              <th className={tableHeadClass}>{t('common.date')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.type}-${r.id}`} className="hover:bg-accent/10">
                <td className={tableCellClass}><TypeBadge type={r.type} t={t} /></td>
                <td className={tableCellClass}>
                  {r.type === 'invoice' ? (
                    <button onClick={() => onDownloadInvoice?.(r.id)} disabled={printingId === r.id}
                      className="font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:text-[#787774] disabled:no-underline disabled:cursor-not-allowed text-left"
                    >
                      {printingId === r.id ? '...' : r.invoiceNumber}
                    </button>
                  ) : (
                    <span className="font-medium">{r.description}</span>
                  )}
                </td>
                <td className={`${tableCellClass} text-[#787774]`}>
                  {r.type === 'invoice' ? (r.secondary || '—') : (r.category || '—')}
                </td>
                <td className={tableCellClass}>{formatExpenseAmount(r.amount, r.currency)}</td>
                <td className={tableCellClass}>{formatExpenseAmount(r.paidAmount, r.currency)}</td>
                <td className={tableCellClass}>{r.refundedAmount > 0 ? <MoneyAmount amount={r.refundedAmount} currency={r.currency} /> : '—'}</td>
                <td className={`${tableCellClass} font-medium ${r.remainingBalance > 0 ? 'text-[#9F2F2D]' : 'text-green-600'}`}>
                  {r.remainingBalance > 0 ? formatExpenseAmount(r.remainingBalance, r.currency) : '0'}
                </td>
                <td className={`${tableCellClass} text-[#787774]`}>
                  {r.method ? (PAYMENT_METHOD_LABELS[r.method as keyof typeof PAYMENT_METHOD_LABELS] ?? r.method) : '—'}
                </td>
                <td className={tableCellClass}><StatusBadge status={r.status} type={r.type} /></td>
                <td className={`${tableCellClass} text-[#787774]`}>{r.date?.slice(0, 10) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onPrev={onPrev} onNext={onNext}
        from={page * PAGE_SIZE} to={page * PAGE_SIZE + rows.length} total={rows.length + (page * PAGE_SIZE)} t={t} />
    </div>
  )
}

function mergeRows(invoices: ReportInvoiceDetail[], expenses: ReportExpenseDetail[]): CombinedRow[] {
  const inv: CombinedRow[] = invoices.map((i) => ({
    id: i.id, type: 'invoice' as RecordType,
    invoiceNumber: i.invoiceNumber,
    description: `${i.invoiceNumber} - ${i.guestName ?? i.companyName ?? ''}`,
    secondary: i.guestName ?? i.companyName ?? '—',
    amount: i.amount, currency: i.currency, paidAmount: i.paidAmount, refundedAmount: i.refundedAmount,
    remainingBalance: i.remainingBalance, totalAmount: i.amount, taxAmount: 0,
    vendor: null, category: null, costCenter: null, room: i.roomNumber,
    method: i.paymentMethod, status: i.status, date: i.issueDate,
  }))
  const exp: CombinedRow[] = expenses.map((e) => ({
    id: e.id, type: 'expense' as RecordType,
    description: e.description,
    secondary: e.categoryName ?? '—',
    amount: e.totalAmount, currency: e.currency, paidAmount: e.status === 'paid' ? e.totalAmount : 0, refundedAmount: 0,
    remainingBalance: e.status === 'approved' ? e.totalAmount : 0, totalAmount: e.totalAmount, taxAmount: e.taxAmount,
    vendor: e.vendor, category: e.categoryName, costCenter: e.costCenter, room: null,
    method: e.paymentMethod, status: e.status, date: e.date,
    invoiceNumber: undefined,
  }))
  return [...inv, ...exp].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

const EMPTY_INVOICES: DailyRevenueReport['invoices'] = []
const EMPTY_EXPENSES: DailyRevenueReport['expenseDetails'] = []

export function ReportsTab({ t }: Props) {
  const { currencyCode } = useCurrency()
  const locale = useLocale()
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [exportingCsv, setExportingCsv] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [printingId, setPrintingId] = useState<string | null>(null)

  const reportUrl = reportType === 'daily'
    ? `/api/accounting/reports/daily-revenue?date=${date}`
    : `/api/accounting/reports/monthly-revenue?month=${month}`
  const report = useResource<DailyRevenueReport | MonthlyRevenueReport>(reportUrl, () => fetchData(reportUrl))
  const dailyReport = reportType === 'daily' ? (report.data as DailyRevenueReport | undefined) ?? null : null
  const monthlyReport = reportType === 'monthly' ? (report.data as MonthlyRevenueReport | undefined) ?? null : null
  const loading = report.isLoading
  const lastUpdated = report.updatedAt ? new Date(report.updatedAt) : null
  const loadReport = report.refresh

  // Pagination restarts whenever a different report is shown.
  const [pageState, setPageState] = useState({ url: reportUrl, page: 0 })
  const page = pageState.url === reportUrl ? pageState.page : 0
  const setPage = (update: (page: number) => number) => setPageState({ url: reportUrl, page: update(page) })

  const activeReport = reportType === 'daily' ? dailyReport : monthlyReport
  const invoices = activeReport?.invoices ?? EMPTY_INVOICES
  const expenseDetails = activeReport?.expenseDetails ?? EMPTY_EXPENSES

  const allRows = useMemo(() => mergeRows(invoices, expenseDetails), [invoices, expenseDetails])
  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE))
  const pageRows = allRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  // Invoices can be in different currencies: totals stay per currency.
  const invoiceTotal = (value: (i: (typeof invoices)[number]) => number) => toMoney(invoices.map((i) => ({ amount: value(i), currency: i.currency })))
  const totalPaid = invoiceTotal((i) => i.paidAmount)
  const totalRefunded = invoiceTotal((i) => i.refundedAmount)
  const totalRemaining = invoiceTotal((i) => i.remainingBalance)
  const totalAmount = (reportType === 'daily' ? dailyReport?.totalRevenue : monthlyReport?.totalRevenue) ?? []
  const totalExpenses = (reportType === 'daily' ? dailyReport?.expenses : monthlyReport?.expenses) ?? []

  const handleExportCsv = useCallback(async () => {
    setExportingCsv(true)
    await new Promise<void>(r => setTimeout(r, 0))
    try {
      if (reportType === 'daily' && dailyReport) {
        exportDailyRevenueCsv(dailyReport, currencyCode)
      } else if (reportType === 'monthly' && monthlyReport) {
        exportMonthlyRevenueCsv(monthlyReport, currencyCode)
      }
    } finally {
      setExportingCsv(false)
    }
  }, [reportType, dailyReport, monthlyReport, currencyCode])

  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true)
    try {
      if (reportType === 'daily' && dailyReport) {
        await exportDailyRevenuePdf(dailyReport, locale as 'en' | 'ar', `daily-revenue-${date}.pdf`, currencyCode)
      } else if (reportType === 'monthly' && monthlyReport) {
        await exportMonthlyRevenuePdf(monthlyReport, locale as 'en' | 'ar', `monthly-revenue-${month}.pdf`, currencyCode)
      }
    } finally {
      setExportingPdf(false)
    }
  }, [reportType, dailyReport, monthlyReport, locale, date, month, currencyCode])

  const handleDownloadInvoice = useCallback(async (id: string) => {
    setPrintingId(id)
    try {
      const res = await fetch(`/api/accounting/invoices/${id}`)
      if (!res.ok) {
        console.error('[ReportsTab] fetch invoice FAILED', res.status)
        const { toast } = await import('@/shared/toast/toastEvents')
        toast.error('Failed to load invoice')
        return
      }
      const json = await res.json()
      const full = json.data ?? json
      const { downloadInvoicePdf } = await import('@/modules/accounting/utils/invoicePdfExport')
      await downloadInvoicePdf(full, locale)
    } catch (err) {
      console.error('[ReportsTab] handleDownloadInvoice FAILED', err)
    }
    finally { setPrintingId(null) }
  }, [locale])

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-[#F5F5F5] rounded-lg p-1 w-full overflow-x-auto">
        {(['daily', 'monthly'] as const).map((type) => (
          <button key={type} onClick={() => setReportType(type)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              reportType === type ? 'bg-accent/10 text-accent-ink' : 'text-[#787774] hover:text-[#333333]'
            }`}>
            {t(`accounting.reports.${type}`)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {reportType === 'daily' && (
          <input type="date" className="h-9 rounded-lg border border-[#D4D4D4] px-3 text-sm"
            value={date} onChange={(e) => setDate(e.target.value)} />
        )}
        {reportType === 'monthly' && (
          <input type="month" className="h-9 rounded-lg border border-[#D4D4D4] px-3 text-sm"
            value={month} onChange={(e) => setMonth(e.target.value)} />
        )}
        <button onClick={loadReport}
          className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent-hover">
          {t('common.search')}
        </button>
        <ToolbarExportGroup onExportCsv={handleExportCsv} onExportPdf={handleExportPdf} csvLabel="CSV" pdfLabel="PDF" csvExporting={exportingCsv} pdfExporting={exportingPdf} />
      </div>

      {lastUpdated && (
        <p className="text-xs text-[#787774]">
          {t('accounting.reports.lastUpdated')}: {formatDate(lastUpdated.toISOString(), locale)}
        </p>
      )}
      {expenseDetails.some((expense) => !expense.currency) && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t('accounting.expenses.unresolvedCurrencyWarning')}</p>}

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}

      {!loading && reportType === 'daily' && dailyReport && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label={t('accounting.reports.roomRevenue')} value={<MoneyTotals value={dailyReport.roomRevenue} />} />
            <MetricCard label={t('accounting.reports.extraServices')} value={<MoneyTotals value={dailyReport.extraServices} />} />
            <MetricCard label={t('accounting.reports.taxCollected')} value={<MoneyTotals value={dailyReport.taxCollected} />} />
            <MetricCard label={t('accounting.reports.netRevenue')} value={<MoneyTotals value={dailyReport.netRevenue} />} positive={isNonNegativeMoney(dailyReport.netRevenue)} />
          </div>

          <div className={cardClass}>
            <h4 className="text-sm font-medium text-[#333333] mb-3">{t('accounting.reports.paymentMethods')}</h4>
            {dailyReport.payments.length === 0 && <p className="text-sm text-[#787774]">{t('accounting.reports.noData')}</p>}
            {dailyReport.payments.map((p, i) => (
              <div key={i} className="flex justify-between py-1 text-sm border-b border-gray-50 last:border-0">
                <span className="text-[#555555]">{PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.method}</span>
                <span className="font-medium"><MoneyTotals value={p.amount} /></span>
              </div>
            ))}
          </div>

          <div className={cardClass}>
            <h4 className="text-sm font-medium text-[#333333] mb-3">{t('accounting.reports.allRecords').replace('{count}', String(allRows.length))}</h4>
            <CombinedTable rows={pageRows} page={page} totalPages={totalPages}
              onPrev={() => setPage(p => Math.max(0, p - 1))}
              onNext={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              onDownloadInvoice={handleDownloadInvoice} printingId={printingId} t={t} />
            <div className="mt-3 pt-3 border-t border-[#EAEAEA] space-y-1">
              <SummaryRow label={t('accounting.reports.totalRevenue')} value={<MoneyTotals value={totalAmount} />} />
              <SummaryRow label={t('accounting.finance.paid')} value={<MoneyTotals value={totalPaid} />} positive />
              <SummaryRow label={t('accounting.invoices.refunded')} value={<MoneyTotals value={totalRefunded} />} positive={false} />
              <SummaryRow label={t('accounting.overview.outstanding')} value={<MoneyTotals value={totalRemaining} />}
                positive={totalRemaining.length === 0} />
              <SummaryRow label={t('accounting.overview.totalExpenses')} value={<MoneyTotals value={totalExpenses} />} positive={false} />
            </div>
          </div>
        </div>
      )}

      {!loading && reportType === 'monthly' && monthlyReport && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard label={t('accounting.reports.roomRevenue')} value={<MoneyTotals value={monthlyReport.roomRevenue} />} />
            <MetricCard label={t('accounting.reports.otherRevenue')} value={<MoneyTotals value={monthlyReport.otherRevenue} />} />
            <MetricCard label={t('accounting.reports.totalRevenue')} value={<MoneyTotals value={monthlyReport.totalRevenue} />} positive />
            <MetricCard label={t('accounting.reports.expenses')} value={<MoneyTotals value={monthlyReport.expenses} />} positive={false} />
            <MetricCard label={t('accounting.reports.netProfit')} value={<MoneyTotals value={monthlyReport.netProfit} />} positive={isNonNegativeMoney(monthlyReport.netProfit)} />
            <MetricCard label={t('accounting.reports.occupancyRate')} value={monthlyReport.occupancyRate > 0 ? `${monthlyReport.occupancyRate.toFixed(1)}%` : '—'} />
          </div>

          <div className={cardClass}>
            <h4 className="text-sm font-medium text-[#333333] mb-3">{t('accounting.reports.allRecords').replace('{count}', String(allRows.length))}</h4>
            <CombinedTable rows={pageRows} page={page} totalPages={totalPages}
              onPrev={() => setPage(p => Math.max(0, p - 1))}
              onNext={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              onDownloadInvoice={handleDownloadInvoice} printingId={printingId} t={t} />
            <div className="mt-3 pt-3 border-t border-[#EAEAEA] space-y-1">
              <SummaryRow label={t('accounting.reports.totalRevenue')} value={<MoneyTotals value={totalAmount} />} />
              <SummaryRow label={t('accounting.finance.paid')} value={<MoneyTotals value={totalPaid} />} positive />
              <SummaryRow label={t('accounting.invoices.refunded')} value={<MoneyTotals value={totalRefunded} />} positive={false} />
              <SummaryRow label={t('accounting.overview.outstanding')} value={<MoneyTotals value={totalRemaining} />}
                positive={totalRemaining.length === 0} />
              <SummaryRow label={t('accounting.overview.totalExpenses')} value={<MoneyTotals value={totalExpenses} />} positive={false} />
            </div>
          </div>
        </div>
      )}

      {!loading && !dailyReport && !monthlyReport && (
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-10 text-center space-y-1">
          <p className="text-sm text-[#787774]">{t('accounting.reports.selectAndSearch')}</p>
        </div>
      )}
    </div>
  )
}

function SummaryRow({ label, value, positive }: { label: string; value: ReactNode; positive?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 text-sm border-b border-gray-50 last:border-0">
      <span className="text-[#555555]">{label}</span>
      <span className={`font-semibold ${positive === true ? 'text-green-600' : positive === false ? 'text-[#9F2F2D]' : 'text-[#1A1A1A]'}`}>{value}</span>
    </div>
  )
}
