'use client'

import { useState, useMemo, useCallback } from 'react'
import { fetchData, useResource } from '@/shared/data/useResource'
import { Table } from '@/shared/components/Table'
import type { TableColumn } from '@/shared/table/types'
import { FloatingInput } from '@/shared/components/FloatingField'
import { useCurrency } from '@/shared/contexts/CurrencyContext'

import { useLocale } from '@/i18n/components/LocaleContext'
import { formatDateTime } from '@/shared/utils/date'
import type { Payment, PaymentMethod, Invoice } from '../types'
import { PAYMENT_METHOD_LABELS } from '../types'
import { downloadInvoicePdf } from '../utils/invoicePdfExport'

const EMPTY_PAYMENTS: Payment[] = []

interface Props {
  t: (key: string) => string
}

export function PaymentsTab({ t }: Props) {
  const { formatCurrency, formatTotals } = useCurrency()
  const locale = useLocale()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [printingId, setPrintingId] = useState<string | null>(null)

  const params = new URLSearchParams()
  if (fromDate) params.set('fromDate', fromDate)
  if (toDate) params.set('toDate', toDate)
  if (methodFilter) params.set('method', methodFilter)
  const paymentsUrl = `/api/accounting/payments${params.size ? `?${params}` : ''}`
  const { data, isFetching: loading, refresh: loadPayments } = useResource<Payment[]>(paymentsUrl, () => fetchData(paymentsUrl))
  const payments = data ?? EMPTY_PAYMENTS

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

  const totals = formatTotals(payments.map((p) => ({ amount: Number(p.amount), currency: p.currency })))

  const columns: TableColumn<Payment>[] = useMemo(() => [
    {
      key: 'type',
      label: t('accounting.payments.type'),
      render: (v) => PAYMENT_METHOD_LABELS[v as PaymentMethod] ?? v,
    },
    {
      key: 'amount',
      label: t('accounting.payments.amount'),
      sortable: true,
      render: (v, row) => {
        const amt = Number(v)
        return <span className={amt < 0 ? 'text-[#9F2F2D]' : 'text-green-600'}>{formatCurrency(amt, row.currency)}</span>
      },
    },
    {
      key: 'invoiceNumber',
      label: t('accounting.invoices.invoice'),
      render: (v, row) => {
        const number = v as string | null
        if (!number) return <span className="text-xs text-[#A8A29E]">{row.invoiceId?.slice(0, 8)}…</span>
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
      key: 'createdAt',
      label: t('common.date'),
      render: (v) => v ? formatDateTime(v as string, locale) : '',
    },
  ], [t, formatCurrency, printingId, handlePrintPdf, locale])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            className="rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="">{t('common.all')}</option>
            {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((key) => (
              <option key={key} value={key}>{PAYMENT_METHOD_LABELS[key]}</option>
            ))}
          </select>
          <FloatingInput
            type="date" max={toDate || undefined}
            label={t('accounting.finance.fromDate')}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            wrapperClassName="sm:max-w-40"
          />
          <FloatingInput
            type="date" min={fromDate || undefined}
            label={t('accounting.finance.toDate')}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            wrapperClassName="sm:max-w-40"
          />
        </div>
        <button
          onClick={loadPayments}
          className="h-9 rounded-lg bg-[#1A1A1A] px-4 text-sm font-medium text-white hover:bg-[#333333]"
        >
          {t('common.refresh')}
        </button>
      </div>

      <div className="rounded-xl border border-[#EAEAEA] bg-white p-5 space-y-1">
        <p className="text-xs text-[#787774]">{t('accounting.finance.totalRevenue')}</p>
        <p className="text-2xl font-bold text-[#1A1A1A]">{totals}</p>
      </div>

      <Table
        data={payments}
        columns={columns}
        loading={loading}
        pageSize={10}
        pageSizeOptions={[10, 20, 50, 100]}
      />
    </div>
  )
}
