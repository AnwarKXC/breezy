'use client'

import { memo } from 'react'
import { TableActionsMenu } from '@/shared/table'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { CurrencyCode } from '@/shared/utils/types'
import { useLocale } from '@/i18n/components/LocaleContext'
import { formatDate } from '@/shared/utils/date'
import type { Invoice } from '../types'
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../types'

interface InvoiceGridCardProps {
  invoice: Invoice
  t: (key: string) => string
  onView?: (invoice: Invoice) => void
  onEdit?: (invoice: Invoice) => void
  onPay?: (invoice: Invoice) => void
  onVoid?: (invoice: Invoice) => void
  onRefund?: (invoice: Invoice) => void
  onDelete?: (invoice: Invoice) => void
  onPrintPdf?: (invoice: Invoice) => void
  onDiscount?: (invoice: Invoice) => void
  printingId?: string | null
  onIssue?: (invoice: Invoice) => void
}

function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (status) {
    case 'paid': return 'success'
    case 'partially_paid': return 'warning'
    case 'partially_refunded': return 'warning'
    case 'overdue': return 'error'
    case 'issued': return 'info'
    case 'draft': return 'default'
    case 'void': return 'default'
    case 'refunded': return 'default'
    default: return 'default'
  }
}

export const InvoiceGridCard = memo(function InvoiceGridCard({
  invoice,
  t,
  onView,
  onEdit,
  onPay,
  onVoid,
  onRefund,
  onDelete,
  onPrintPdf,
  onDiscount,
  printingId,
  onIssue,
}: InvoiceGridCardProps) {
  const { formatCurrency } = useCurrency()
  const locale = useLocale()
  const isPrinting = printingId === invoice.id
  // ponytail: pass invoice.currency as `from` so display shows the converted
  // amount in system currency when the row is stored in a different currency.
  const from = invoice.currency as CurrencyCode | undefined
  const fmt = (amount: number) => formatCurrency(amount, from)

  const actions = [
    { label: t('accounting.invoices.actions.viewDetail'), onSelect: () => onView?.(invoice) },
    ...(onPrintPdf ? [{ label: t('accounting.invoices.actions.printPdf') || 'Print PDF', onSelect: () => onPrintPdf(invoice) }] : []),
    ...(invoice.status === 'draft' || invoice.status === 'issued'
      ? [{ label: invoice.status === 'draft' ? t('accounting.invoices.actions.editDraft') : 'Edit', onSelect: () => onEdit?.(invoice) }]
      : []),
    ...(invoice.status === 'draft'
      ? [{ label: t('accounting.invoices.actions.issueInvoice'), onSelect: () => onIssue?.(invoice) }]
      : []),
    ...(invoice.status === 'issued' || invoice.status === 'partially_paid'
      ? [{ label: t('accounting.invoices.actions.recordPayment'), onSelect: () => onPay?.(invoice) }]
      : []),
    ...(onDiscount && invoice.status !== 'void' && invoice.status !== 'refunded'
      ? [{ label: t('accounting.invoices.actions.applyDiscount'), onSelect: () => onDiscount(invoice) }]
      : []),
    ...(invoice.status !== 'void' && invoice.status !== 'refunded' && invoice.status !== 'partially_refunded' && invoice.status !== 'paid'
      ? [{ label: t('accounting.invoices.actions.voidInvoice'), onSelect: () => onVoid?.(invoice), destructive: true as const }]
      : []),
    ...(invoice.status === 'paid' || invoice.status === 'partially_paid' || invoice.status === 'partially_refunded'
      ? [{ label: t('accounting.invoices.actions.refundInvoice'), onSelect: () => onRefund?.(invoice), destructive: true as const }]
      : []),
    ...(invoice.status === 'draft' || invoice.status === 'issued'
      ? [{ label: t('common.delete'), onSelect: () => onDelete?.(invoice), destructive: true as const }]
      : []),
  ]

  const bal = Number(invoice.remainingBalance)

  return (
    <article className="min-w-0 rounded-xl border border-[#EAEAEA] bg-white p-5  transition duration-200 hover:">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPrintPdf?.(invoice) }}
              disabled={isPrinting}
              className="cursor-pointer truncate text-base font-bold text-[#346538] underline underline-offset-2 hover:text-[#1A1A1A] transition-colors disabled:cursor-wait disabled:opacity-50"
            >
              {isPrinting ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {invoice.invoiceNumber}
                </span>
              ) : invoice.invoiceNumber}
            </button>
            <StatusBadge
              status={invoice.status}
              variant={getStatusVariant(invoice.status)}
              label={INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
            />
          </div>
          <p className="mt-1 truncate text-sm text-[#787774]">
            {invoice.contact?.name ?? invoice.guestName ?? invoice.contactId}
          </p>
        </div>
        <TableActionsMenu
          actions={actions.filter(Boolean)}
          ariaLabel={t('common.actions')}
        />
      </div>

      <dl className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">
            {t('accounting.invoices.roomNumber')}
          </dt>
          <dd className="text-sm text-[#555555]">{invoice.roomNumber ?? '-'}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">
            {t('accounting.invoices.paymentMethod')}
          </dt>
          <dd className="text-sm text-[#555555]">
            {invoice.paymentMethod
              ? (PAYMENT_METHOD_LABELS as Record<string, string>)[invoice.paymentMethod] ?? invoice.paymentMethod
              : '-'}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">
            {t('accounting.invoices.amount')}
          </dt>
          <dd className="text-sm font-semibold text-[#1A1A1A]">
            {fmt(Number(invoice.amount))}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">
            {t('accounting.invoices.paid')}
          </dt>
          <dd className="text-sm text-[#555555]">{fmt(Number(invoice.paidAmount))}</dd>
        </div>
        {Number(invoice.refundedAmount) > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">
              {t('accounting.invoices.refund')}
            </dt>
            <dd className="text-sm font-medium text-[#9F2F2D]">{fmt(Number(invoice.refundedAmount))}</dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">
            {t('accounting.invoices.balance')}
          </dt>
          <dd className={`text-sm font-medium ${bal > 0 ? 'text-amber-600' : 'text-[#787774]'}`}>
            {fmt(bal)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs font-medium uppercase tracking-[0.18em] text-[#787774]">
            {t('accounting.invoices.dueDate')}
          </dt>
          <dd className="text-sm text-[#555555]">{formatDate(invoice.dueDate, locale)}</dd>
        </div>
      </dl>
    </article>
  )
})
