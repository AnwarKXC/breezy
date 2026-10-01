'use client'

import { useState, useMemo, useCallback } from 'react'
import { useLedger } from '../hooks'
import { Table } from '@/shared/components/Table'
import type { TableColumn } from '@/shared/table/types'
import { FloatingInput } from '@/shared/components/FloatingField'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { useLocale } from '@/i18n/components/LocaleContext'
import { formatDate, formatDateTime } from '@/shared/utils/date'
import type { LedgerEntry, Invoice } from '../types'
import { LEDGER_TYPE_LABELS } from '../types'
import { downloadInvoicePdf } from '../utils/invoicePdfExport'
import { fetchData, useResource } from '@/shared/data/useResource'
import type { Money } from '@/shared/currency/money'
import { buttonSecondary } from '../utils/buttonStyles'
import { MoneyTotals } from '@/shared/components/MoneyTotals'
import { MoneyAmount } from '@/shared/components/MoneyTotals'

interface Props {
  t: (key: string) => string
}

export function LedgerTab({ t }: Props) {
  const locale = useLocale()
  const [typeFilter, setTypeFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    if (typeFilter) f.type = typeFilter
    if (fromDate) f.fromDate = fromDate
    if (toDate) f.toDate = toDate
    return f
  }, [typeFilter, fromDate, toDate])

  const { ledgerEntries, loading } = useLedger({ ...filters, limit: '100', offset: String(page * 100) })

  const handlePrintPdf = useCallback(async (invoiceId: string | null, invoiceNumber: string | null) => {
    if (!invoiceId || !invoiceNumber) return
    setPrintingId(invoiceId)
    try {
      const res = await fetch(`/api/accounting/invoices/${invoiceId}`)
      if (res.ok) {
        const json = await res.json()
        const invoice = (json?.data ?? json) as Invoice
        await downloadInvoicePdf(invoice, locale)
      }
    } finally {
      setPrintingId(null)
    }
  }, [locale])

  const summaryUrl = `/api/accounting/ledger?${new URLSearchParams({ ...filters, summary: '1' })}`
  const { data: summary, error: summaryError } = useResource<{ income: Money; outcome: Money; count: number }>(summaryUrl, () => fetchData(summaryUrl))
  // All matching rows contribute, including rows beyond the visible page.
  // Operational ledger income includes invoice postings; it is not a cash-flow statement.
  const totals = {
    income: summary ? <MoneyTotals value={summary.income} /> : '—',
    outcome: summary ? <MoneyTotals value={summary.outcome} /> : '—',
  }

  const columns: TableColumn<LedgerEntry>[] = useMemo(() => [
    {
      key: 'transactionNumber',
      label: t('accounting.ledger.txNumber'),
    },
    {
      key: 'type',
      label: t('accounting.ledger.type'),
      render: (v) => (
        <StatusBadge
          status={String(v)}
          label={LEDGER_TYPE_LABELS[String(v)] ?? String(v)}
        />
      ),
    },
    {
      key: 'reference',
      label: t('accounting.ledger.reference'),
      render: (v, row) => {
        const number = (v as string | null) ?? row.invoiceNumber
        if (!number) return <span className="text-xs text-[#A8A29E]">-</span>
        return (
          <button
            type="button"
            onClick={() => handlePrintPdf(row.invoiceId, number)}
            disabled={printingId === row.invoiceId}
            className="cursor-pointer text-sm font-medium text-[#346538] underline underline-offset-2 hover:text-[#1A1A1A] transition-colors disabled:cursor-wait disabled:opacity-50"
          >
            {printingId === row.invoiceId ? (
              <span className="inline-flex items-center gap-1.5">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {number}
              </span>
            ) : number}
          </button>
        )
      },
    },
    {
      key: 'description',
      label: t('common.description'),
    },
    {
      key: 'incomeAmount',
      label: t('accounting.ledger.income'),
      render: (v, row) => Number(v) > 0 ? <MoneyAmount amount={Number(v)} currency={row.currency} /> : '-',
    },
    {
      key: 'outcomeAmount',
      label: t('accounting.ledger.outcome'),
      render: (v, row) => Number(v) > 0 ? <MoneyAmount amount={Number(v)} currency={row.currency} /> : '-',
    },
    {
      key: 'transactionDate',
      label: t('accounting.ledger.date'),
      render: (v) => v ? formatDate(v as string, locale) : '-',
    },
    {
      key: 'createdAt',
      label: t('common.createdAt'),
      render: (v) => v ? formatDateTime(v as string, locale) : '',
    },
  ], [t, printingId, handlePrintPdf, locale])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0) }}
        >
          <option value="">{t('common.all')}</option>
          {Object.entries(LEDGER_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <FloatingInput
          type="date" max={toDate || undefined}
          label={t('accounting.finance.fromDate')}
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setPage(0) }}
          wrapperClassName="sm:max-w-40"
        />
        <FloatingInput
          type="date" min={fromDate || undefined}
          label={t('accounting.finance.toDate')}
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); setPage(0) }}
          wrapperClassName="sm:max-w-40"
        />
      </div>

      {summaryError && <p role="alert" className="text-sm text-red-700">{summaryError.message}</p>}
      <p className="text-xs text-stone-500">{t('accounting.journal.operationalLedgerHint')}</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-1">
          <p className="text-sm text-[#787774]">{t('accounting.ledger.totalIncome')}</p>
          <p className="text-2xl font-bold text-green-600">{totals.income}</p>
        </div>
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-1">
          <p className="text-sm text-[#787774]">{t('accounting.ledger.totalOutcome')}</p>
          <p className="text-2xl font-bold text-[#9F2F2D]">{totals.outcome}</p>
        </div>
      </div>

      <Table
        data={ledgerEntries}
        columns={columns}
        loading={loading}
        pageSize={15}
        pageSizeOptions={[10, 20, 50, 100]}
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button className={buttonSecondary} disabled={loading || page === 0} onClick={() => setPage(page - 1)}>{t('accounting.journal.previous')}</button>
        <span>{page * 100 + (ledgerEntries.length ? 1 : 0)}–{page * 100 + ledgerEntries.length} / {summary?.count ?? '—'}</span>
        <button className={buttonSecondary} disabled={loading || !summary || (page + 1) * 100 >= summary.count} onClick={() => setPage(page + 1)}>{t('accounting.journal.next')}</button>
      </div>
    </div>
  )
}
