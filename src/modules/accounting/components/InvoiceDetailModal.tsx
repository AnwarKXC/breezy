'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useInvoices } from '../hooks/useInvoices'
import { Modal } from '@/shared/components/Modal'
import { StatusBadge } from '@/shared/components/StatusBadge'
import { InvoicePaymentsModal } from './InvoicePaymentsModal'
import { VoidConfirmDialog } from './VoidConfirmDialog'
import { RefundConfirmDialog } from './RefundConfirmDialog'
import { CurrencyScope, useCurrency } from '@/shared/contexts/CurrencyContext'
import type { CurrencyCode } from '@/shared/utils/types'
import { useLocale } from '@/i18n/components/LocaleContext'
import { downloadInvoicePdf } from '../utils/invoicePdfExport'
import { formatDate, formatDateTime } from '@/shared/utils/date'
import type { Invoice, Payment } from '../types'
import { INVOICE_STATUS_LABELS, INVOICE_ITEM_TYPE_LABELS, PAYMENT_METHOD_LABELS, LEDGER_TYPE_LABELS } from '../types'
import { MoneyAmount } from '@/shared/components/MoneyTotals'

interface Props {
  invoiceId: string
  t: (key: string) => string
  onClose: () => void
  onEdit: (invoice: Invoice) => void
}

type DetailTab = 'overview' | 'items' | 'payments' | 'ledger' | 'events'

function getStatusVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (status) {
    case 'paid': return 'success'
    case 'partially_paid': return 'warning'
    case 'overdue': return 'error'
    case 'issued': return 'info'
    case 'draft': return 'default'
    case 'void': return 'default'
    case 'refunded': return 'default'
    case 'partially_refunded': return 'warning'
    default: return 'default'
  }
}

const NO_PAYMENTS: Payment[] = []

export function InvoiceDetailModal({ invoiceId, t, onClose, onEdit }: Props) {
  const { formatCurrency } = useCurrency()
  const locale = useLocale()
  const { currentInvoice, loadById, invoiceLedger, invoiceEvents, loadLedger, loadEvents, clearCurrent } = useInvoices()
  // ponytail: pass invoice.currency as `from` so formatCurrency converts to
  // system currency when the row is stored in a different currency.
  const fmt = (amount: number) => formatCurrency(amount, currentInvoice?.currency as CurrencyCode | undefined)
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [showPayments, setShowPayments] = useState(false)
  const [showVoid, setShowVoid] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [printingPdf, setPrintingPdf] = useState(false)

  useEffect(() => {
    loadById(invoiceId)
    loadLedger(invoiceId)
    loadEvents(invoiceId)
    return () => { clearCurrent() }
  }, [invoiceId, loadById, loadLedger, loadEvents, clearCurrent])

  const handleLoadLedger = useCallback(() => {
    loadLedger(invoiceId)
    setActiveTab('ledger')
  }, [invoiceId, loadLedger])

  const handleLoadEvents = useCallback(() => {
    loadEvents(invoiceId)
    setActiveTab('events')
  }, [invoiceId, loadEvents])

  const handleIssue = useCallback(async () => {
    setIssuing(true)
    try {
      const res = await fetch(`/api/accounting/invoices/${invoiceId}/issue`, { method: 'POST' })
      if (res.ok) loadById(invoiceId)
    } catch { /* handled */ }
    finally { setIssuing(false) }
  }, [invoiceId, loadById])

  const handlePrintPdf = useCallback(async () => {
    if (!currentInvoice) return
    setPrintingPdf(true)
    try {
      await downloadInvoicePdf(currentInvoice, locale)
    } catch (err) {
      console.error('[InvoiceDetailModal] handlePrintPdf FAILED', err)
    }
    finally { setPrintingPdf(false) }
  }, [currentInvoice, locale])

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'overview', label: t('accounting.invoices.detail.overview') },
    { key: 'items', label: t('accounting.invoices.detail.lineItems') },
    { key: 'payments', label: t('accounting.invoices.detail.payments') },
    { key: 'ledger', label: t('accounting.invoices.detail.ledger') },
    { key: 'events', label: t('accounting.invoices.detail.auditHistory') },
  ]

  const invoice = currentInvoice
  const payments = invoice?.payments ?? NO_PAYMENTS
  const timeline = useMemo(() => {
    const paymentItems = payments.map((payment) => ({
      amount: Number(payment.amount),
      date: payment.createdAt ?? '',
      description: payment.description ?? PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
      id: `payment-${payment.id}`,
      kind: Number(payment.amount) < 0 ? t('accounting.invoiceEvents.payment_refunded') : t('accounting.invoiceEvents.payment_recorded'),
    }))
    const eventItems = (invoice?.events ?? invoiceEvents)
      .filter((event) => event.eventType !== 'payment_refunded') // Refund payment already in timeline
      .map((event) => ({
        amount: event.amountChanged ?? 0,
        date: event.createdAt ?? '',
        description: event.reason ?? (event.oldStatus && event.newStatus ? `${event.oldStatus} -> ${event.newStatus}` : ''),
        id: `event-${event.id}`,
        kind: eventLabels(event.eventType, t),
      }))

    return [...paymentItems, ...eventItems]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 8)
  }, [invoice?.events, invoiceEvents, payments, t])

  if (!invoice) {
    return (
      <Modal isOpen onClose={onClose} title={t('common.loading')}>
        <div className="flex h-48 items-center justify-center text-[#787774]">{t('common.loading')}</div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${t('accounting.invoices.invoice')} #${invoice.invoiceNumber}`}
      size="xl"
    >
      <CurrencyScope code={invoice.currency}>
      <div className="flex max-h-[min(84vh,860px)] flex-col overflow-hidden">
        <div className="shrink-0 border-b border-[#EAEAEA] pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={invoice.status}
                  variant={getStatusVariant(invoice.status)}
                  label={INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
                />
                <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-xs font-medium text-[#555555]">
                  {invoice.currency}
                </span>
              </div>
              <p className="mt-2 truncate text-sm text-[#787774]">
                {invoice.contact?.name ?? invoice.companyName ?? invoice.guestName ?? invoice.contactId}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
            {invoice.status === 'draft' && (
              <button
                onClick={handleIssue}
                disabled={issuing}
                className="h-8 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {issuing ? t('accounting.invoices.issuing') : t('accounting.invoices.issue')}
              </button>
            )}
            {invoice.status === 'draft' && (
              <button
                onClick={() => onEdit(invoice)}
                className="h-8 rounded-lg border border-[#D4D4D4] px-3 text-xs font-medium text-[#333333] hover:bg-accent/10"
              >
                {t('common.edit')}
              </button>
            )}
            {(invoice.status === 'issued' || invoice.status === 'partially_paid') && (
              <button
                onClick={() => setShowPayments(true)}
                className="h-8 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {t('accounting.invoices.actions.recordPayment')}
              </button>
            )}
            {invoice.status !== 'void' && invoice.status !== 'refunded' && invoice.status !== 'paid' && (
              <button
                onClick={() => setShowVoid(true)}
                className="h-8 rounded-lg border border-red-300 px-3 text-xs font-medium text-[#9F2F2D] hover:bg-[#FDEBEC]"
              >
                {t('accounting.invoices.void')}
              </button>
            )}
            {(invoice.status === 'paid' || invoice.status === 'partially_paid') && (
              <button
                onClick={() => setShowRefund(true)}
                className="h-8 rounded-lg border border-amber-300 px-3 text-xs font-medium text-amber-600 hover:bg-[#FBF3DB]"
              >
                {t('accounting.invoices.refund')}
              </button>
            )}
            <button
              onClick={handlePrintPdf}
              disabled={printingPdf}
              className="h-8 rounded-lg border border-[#D4D4D4] px-3 text-xs font-medium text-[#333333] hover:bg-accent/10 disabled:opacity-50"
            >
              {printingPdf ? t('common.loading') : t('accounting.invoices.printPdf')}
            </button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-[#EAEAEA] py-3">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                if (key === 'ledger') handleLoadLedger()
                else if (key === 'events') handleLoadEvents()
                else setActiveTab(key)
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === key
                  ? 'bg-[#F5F5F5] text-[#1A1A1A]'
                  : 'text-[#787774] hover:text-[#333333]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: t('accounting.invoices.total'), value: <MoneyAmount amount={invoice.amount} currency={currentInvoice?.currency} />, tone: 'text-[#1A1A1A]' },
                  { label: t('accounting.invoices.paid'), value: <MoneyAmount amount={invoice.paidAmount} currency={currentInvoice?.currency} />, tone: 'text-[#346538]' },
                  { label: t('accounting.invoices.balance'), value: <MoneyAmount amount={invoice.remainingBalance} currency={currentInvoice?.currency} />, tone: invoice.remainingBalance > 0 ? 'text-amber-600' : 'text-[#1A1A1A]' },
                  { label: t('accounting.invoices.refund'), value: <MoneyAmount amount={invoice.refundedAmount} currency={currentInvoice?.currency} />, tone: 'text-[#9F2F2D]' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-[#EAEAEA] bg-white p-3">
                    <p className="text-xs font-medium text-[#787774]">{item.label}</p>
                    <p className={`mt-1 text-lg font-bold ${item.tone}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]">
                <div className="rounded-xl border border-[#EAEAEA] p-4">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">{t('accounting.invoices.detail.overview')}</h3>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#787774]">{t('accounting.invoices.detail.createdBy')}</p>
                  <p className="font-medium">{invoice.createdBy ?? '-'}</p>
                </div>
                {invoice.issuedBy && (
                  <div>
                    <p className="text-[#787774]">{t('accounting.invoices.detail.issuedBy')}</p>
                    <p className="font-medium">{invoice.issuedBy}</p>
                  </div>
                )}
                <div>
                  <p className="text-[#787774]">{t('accounting.invoices.contact')}</p>
                  <p className="font-medium">{invoice.contact?.name ?? invoice.guestName ?? invoice.contactId}</p>
                </div>
                {invoice.roomNumber && (
                  <div>
                    <p className="text-[#787774]">{t('accounting.invoices.roomNumber')}</p>
                    <p className="font-medium">{invoice.roomNumber}</p>
                  </div>
                )}
                {invoice.guestName && (
                  <div>
                    <p className="text-[#787774]">{t('accounting.invoices.wizard.guestName')}</p>
                    <p className="font-medium">{invoice.guestName}</p>
                  </div>
                )}
                {invoice.companyName && (
                  <div>
                    <p className="text-[#787774]">{t('accounting.invoices.wizard.companyName')}</p>
                    <p className="font-medium">{invoice.companyName}</p>
                  </div>
                )}
                <div>
                  <p className="text-[#787774]">{t('accounting.invoices.issueDate')}</p>
                  <p className="font-medium">{formatDate(invoice.issueDate, locale)}</p>
                </div>
                <div>
                  <p className="text-[#787774]">{t('accounting.invoices.dueDate')}</p>
                  <p className="font-medium">{formatDate(invoice.dueDate, locale)}</p>
                </div>
                {invoice.issuedAt && (
                  <div>
                    <p className="text-[#787774]">{t('accounting.invoices.detail.issuedAt')}</p>
                    <p className="font-medium">{formatDateTime(invoice.issuedAt, locale)}</p>
                  </div>
                )}
                {invoice.paidAt && (
                  <div>
                    <p className="text-[#787774]">{t('accounting.invoices.paidAt')}</p>
                    <p className="font-medium">{formatDateTime(invoice.paidAt, locale)}</p>
                  </div>
                )}
                  </div>
              </div>

                <div className="rounded-xl border border-[#EAEAEA] p-4">
                  <h3 className="text-sm font-semibold text-[#1A1A1A]">{t('accounting.invoices.detail.auditHistory')}</h3>
                  {timeline.length === 0 ? (
                    <p className="mt-4 text-sm text-[#787774]">{t('accounting.invoiceEvents.noEvents')}</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {timeline.map((item) => (
                        <div key={item.id} className="flex gap-3 text-sm">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#1A1A1A]" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="font-medium text-[#333333]">{item.kind}</p>
                              {item.amount !== 0 && (
                                <span className={item.amount < 0 ? 'text-[#9F2F2D]' : 'text-[#346538]'}>
                                  {item.amount > 0 ? '+' : ''}{fmt(item.amount)}
                                </span>
                              )}
                            </div>
                            {item.description && <p className="truncate text-xs text-[#787774]">{item.description}</p>}
                            {item.date && <p className="text-xs text-[#787774]">{formatDate(item.date, locale)}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {invoice.billingAddress && (
                <div className="rounded-xl border border-[#EAEAEA] p-4 text-sm">
                  <p className="text-[#787774]">{t('accounting.invoices.billingAddress')}</p>
                  <p className="mt-1 font-medium">{invoice.billingAddress}</p>
                </div>
              )}

              <div className="rounded-xl border border-[#EAEAEA] p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#787774]">{t('accounting.invoices.subtotal')}</span>
                    <span>{fmt(invoice.subtotal)}</span>
                  </div>
                  {invoice.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#787774]">{t('accounting.invoices.discount')}</span>
                      <span className="text-[#9F2F2D]">-{fmt(invoice.discount)}</span>
                    </div>
                  )}
                  {invoice.discount > 0 && invoice.discountReason && (
                    <p className="text-xs text-[#787774]">
                      {t('accounting.invoices.discountReason')}: {invoice.discountReason}
                    </p>
                  )}
                  {invoice.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#787774]">{t('accounting.invoices.tax')}</span>
                      <span>{fmt(invoice.taxAmount)}</span>
                    </div>
                  )}
                  {invoice.serviceCharge > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#787774]">{t('accounting.invoices.serviceCharge')}</span>
                      <span>{fmt(invoice.serviceCharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <span>{t('accounting.invoices.total')}</span>
                    <MoneyAmount inline amount={invoice.amount} currency={currentInvoice?.currency} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#346538]">{t('accounting.invoices.paid')}</span>
                    <span className="text-[#346538]">{fmt(invoice.paidAmount)}</span>
                  </div>
                  {invoice.refundedAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[#9F2F2D]">{t('accounting.invoices.refund')}</span>
                      <span className="text-[#9F2F2D]">{fmt(invoice.refundedAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className={invoice.remainingBalance > 0 ? 'text-amber-600' : 'text-[#787774]'}>
                      {t('accounting.invoices.detail.outstandingBalance')}
                    </span>
                    <span className={invoice.remainingBalance > 0 ? 'font-medium text-amber-600' : ''}>
                      <MoneyAmount inline amount={invoice.remainingBalance} currency={currentInvoice?.currency} />
                    </span>
                  </div>
                </div>
              </div>

              {(invoice.publicNotes || invoice.internalNotes || invoice.voidReason) && (
                <div className="space-y-2 border-t pt-4 text-sm">
                  {invoice.publicNotes && (
                    <div className="rounded-lg bg-[#F9F9F8] p-3">
                      <p className="text-xs text-[#787774]">{t('accounting.invoices.publicNotes')}</p>
                      <p className="mt-1">{invoice.publicNotes}</p>
                    </div>
                  )}
                  {invoice.internalNotes && (
                    <div className="rounded-lg bg-[#F9F9F8] p-3">
                      <p className="text-xs text-[#787774]">{t('accounting.invoices.internalNotes')}</p>
                      <p className="mt-1 text-[#555555]">{invoice.internalNotes}</p>
                    </div>
                  )}
                  {invoice.voidReason && (
                    <div className="rounded-lg border border-[#FDEBEC] bg-[#FDEBEC] p-3">
                      <p className="text-xs text-[#9F2F2D]">{t('accounting.invoices.voidReason')}</p>
                      <p className="mt-1 text-[#9F2F2D]">{invoice.voidReason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'items' && (
            <div>
              {(!invoice.items || invoice.items.length === 0) ? (
                <p className="py-8 text-center text-sm text-[#787774]">{t('common.noData')}</p>
              ) : (
                <div className="space-y-2">
                  {invoice.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-[#EAEAEA] bg-[#F9F9F8]/50 p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-[#787774]">
                            {INVOICE_ITEM_TYPE_LABELS[item.type] ?? item.type}
                          </span>
                          <span className="truncate font-medium text-[#333333]">{item.description}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#787774]">
                          {item.quantity} x {fmt(item.unitPrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{fmt(item.totalPrice)}</p>
                        {(item.discountAmount > 0 || item.taxAmount > 0) && (
                          <p className="text-xs text-[#787774]">
                            {item.discountAmount > 0 && <span>-{fmt(item.discountAmount)} </span>}
                            {item.taxAmount > 0 && <span>+{fmt(item.taxAmount)} </span>}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div>
              {payments.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#787774]">{t('accounting.invoices.detail.noPayments')}</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-[#EAEAEA] bg-[#F9F9F8]/50 p-3 text-sm">
                      <div>
                        <span className="font-medium">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                        {p.description && <span className="ml-2 text-[#787774]">{p.description}</span>}
                        <p className="mt-0.5 text-xs text-[#787774]">{formatDateTime(p.createdAt, locale)}</p>
                      </div>
                      <span className={`font-medium ${Number(p.amount) < 0 ? 'text-[#9F2F2D]' : 'text-[#346538]'}`}>
                        {fmt(Number(p.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'ledger' && (
            <div>
              {invoiceLedger.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#787774]">{t('accounting.invoices.detail.noLedgerEntries')}</p>
              ) : (
                <div className="space-y-2">
                  {invoiceLedger.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-lg border border-[#EAEAEA] bg-[#F9F9F8]/50 p-3 text-sm">
                      <div>
                        <span className="font-medium text-[#333333]">{LEDGER_TYPE_LABELS[entry.type] ?? entry.type}</span>
                        <p className="mt-0.5 text-xs text-[#787774]">{entry.description}</p>
                        <p className="text-xs text-[#787774]">{formatDate(entry.transactionDate, locale)}</p>
                      </div>
                      <div className="text-right">
                        {entry.incomeAmount > 0 && <p className="font-medium text-[#346538]">+{fmt(entry.incomeAmount)}</p>}
                        {entry.outcomeAmount > 0 && <p className="font-medium text-[#9F2F2D]">-{fmt(entry.outcomeAmount)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'events' && (
            <div>
              {invoiceEvents.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#787774]">{t('common.noData')}</p>
              ) : (
                <div className="space-y-2">
                  {invoiceEvents.map((event) => (
                    <div key={event.id} className="flex items-start justify-between rounded-lg border border-[#EAEAEA] bg-[#F9F9F8]/50 p-3 text-sm">
                      <div>
                        <span className="font-medium text-[#333333]">
                          {eventLabels(event.eventType, t)}
                        </span>
                        {event.reason && <p className="mt-0.5 text-xs text-[#787774]">{event.reason}</p>}
                        {event.oldStatus && event.newStatus && (
                          <p className="mt-0.5 text-xs text-[#787774]">
                            {event.oldStatus} → {event.newStatus}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-[#787774]">{formatDateTime(event.createdAt, locale)}</p>
                      </div>
                      {event.amountChanged && event.amountChanged !== 0 && (
                        <span className={`text-xs font-medium ${event.amountChanged < 0 ? 'text-[#9F2F2D]' : 'text-[#346538]'}`}>
                          {event.amountChanged > 0 ? '+' : ''}{fmt(event.amountChanged)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPayments && (
        <InvoicePaymentsModal
          invoiceId={invoiceId}
          invoiceAmount={invoice.amount}
          currency={invoice.currency}
          contactName={invoice.contact?.name ?? invoice.guestName ?? ''}
          onClose={() => setShowPayments(false)}
          onPaymentChanged={() => loadById(invoiceId)}
          t={t}
        />
      )}

      {showVoid && (
        <VoidConfirmDialog
          invoice={invoice}
          t={t}
          onClose={() => setShowVoid(false)}
          onVoided={() => { setShowVoid(false); loadById(invoiceId) }}
        />
      )}

      {showRefund && (
        <RefundConfirmDialog
          invoice={invoice}
          t={t}
          onClose={() => setShowRefund(false)}
          onRefunded={() => { setShowRefund(false); loadById(invoiceId) }}
        />
      )}
      </CurrencyScope>
    </Modal>
  )
}

function eventLabels(type: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    created: t('accounting.invoiceEvents.created'),
    draft_saved: t('accounting.invoiceEvents.draft_saved'),
    updated: t('accounting.invoiceEvents.updated'),
    issued: t('accounting.invoiceEvents.issued'),
    voided: t('accounting.invoiceEvents.voided'),
    deleted: t('accounting.invoiceEvents.deleted'),
    payment_recorded: t('accounting.invoiceEvents.payment_recorded'),
    payment_refunded: t('accounting.invoiceEvents.payment_refunded'),
    payment_voided: t('accounting.invoiceEvents.payment_voided'),
    adjusted: t('accounting.invoiceEvents.adjusted'),
    pdf_downloaded: t('accounting.invoiceEvents.pdf_downloaded'),
    printed: t('accounting.invoiceEvents.printed'),
    status_changed: t('accounting.invoiceEvents.status_changed'),
  }
  return labels[type] ?? type
}
