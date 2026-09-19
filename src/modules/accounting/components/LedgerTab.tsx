'use client'

import { useState, useMemo, useCallback } from 'react'
import { useLedger } from '../hooks'
import { Table } from '@/shared/components/Table'
import type { TableColumn } from '@/shared/table/types'
import { FloatingInput } from '@/shared/components/FloatingField'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useLocale } from '@/i18n/components/LocaleContext'
import { formatDate, formatDateTime } from '@/shared/utils/date'
import type { LedgerEntry, Invoice } from '../types'
import { LEDGER_TYPE_LABELS } from '../types'
import { downloadInvoicePdf } from '../utils/invoicePdfExport'

interface Props {
  t: (key: string) => string
}

export function LedgerTab({ t }: Props) {
  const { formatCurrency } = useCurrency()
  const locale = useLocale()
  const [typeFilter, setTypeFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [printingId, setPrintingId] = useState<string | null>(null)

  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    if (typeFilter) f.type = typeFilter
    if (fromDate) f.fromDate = fromDate
    if (toDate) f.toDate = toDate
    return f
  }, [typeFilter, fromDate, toDate])

  const { ledgerEntries, loading } = useLedger(filters)

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

  const totals = useMemo(() => {
    // Cash-basis: every ledger row is a real money movement.
    return ledgerEntries.reduce(
      (acc, e) => ({
        income: acc.income + Number(e.incomeAmount),
        outcome: acc.outcome + Number(e.outcomeAmount),
      }),
      { income: 0, outcome: 0 },
    )
  }, [ledgerEntries])

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
      render: (v) => Number(v) > 0 ? formatCurrency(Number(v)) : '-',
    },
    {
      key: 'outcomeAmount',
      label: t('accounting.ledger.outcome'),
      render: (v) => Number(v) > 0 ? formatCurrency(Number(v)) : '-',
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
  ], [t, formatCurrency, locale])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          className="rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">{t('common.all')}</option>
          {Object.entries(LEDGER_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <FloatingInput
          type="date"
          label={t('accounting.finance.fromDate')}
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          wrapperClassName="sm:max-w-40"
        />
        <FloatingInput
          type="date"
          label={t('accounting.finance.toDate')}
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          wrapperClassName="sm:max-w-40"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-1">
          <p className="text-sm text-[#787774]">{t('accounting.ledger.totalIncome')}</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.income)}</p>
        </div>
        <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-1">
          <p className="text-sm text-[#787774]">{t('accounting.ledger.totalOutcome')}</p>
          <p className="text-2xl font-bold text-[#9F2F2D]">{formatCurrency(totals.outcome)}</p>
        </div>
      </div>

      <Table
        data={ledgerEntries}
        columns={columns}
        loading={loading}
        pageSize={15}
        pageSizeOptions={[10, 20, 50, 100]}
      />
    </div>
  )
}
