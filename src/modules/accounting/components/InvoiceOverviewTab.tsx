'use client'

import { formatDate, formatDateTime } from '@/shared/utils/date'
import type { Invoice } from '../types'
import type { CurrencyCode } from '@/shared/utils/types'
import { MoneyAmount } from '@/shared/components/MoneyTotals'

interface InvoiceOverviewTabProps {
  invoice: Invoice
  t: (key: string) => string
  locale: string
  formatCurrency: (amount: number, from?: CurrencyCode) => string
  timeline: Array<{ amount: number; date: string; description: string; id: string; kind: string }>
}

export function InvoiceOverviewTab({ invoice, t, locale, formatCurrency, timeline }: InvoiceOverviewTabProps) {
  // ponytail: invoice currency is the canonical source — pass it as `from` to
  // every formatCurrency call so the system-currency conversion kicks in.
  const from = (invoice.currency as CurrencyCode | undefined)

  return (
  <div className="space-y-4"> <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"> {[
  { label: t('accounting.invoices.total'), value: <MoneyAmount amount={invoice.amount} currency={from} />, tone: 'text-[#1A1A1A]' },
  { label: t('accounting.invoices.paid'), value: <MoneyAmount amount={invoice.paidAmount} currency={from} />, tone: 'text-[#346538]' },
  { label: t('accounting.invoices.balance'), value: <MoneyAmount amount={invoice.remainingBalance} currency={from} />, tone: invoice.remainingBalance> 0 ? 'text-amber-600' : 'text-[#1A1A1A]' },
  { label: t('accounting.invoices.refund'), value: <MoneyAmount amount={invoice.refundedAmount} currency={from} />, tone: 'text-[#9F2F2D]' },
  ].map((item) => (
  <div key={item.label} className="rounded-xl border border-[#EAEAEA] bg-white p-3"> <p className="text-xs font-medium text-[#787774]">{item.label}</p> <p className={`mt-1 text-lg font-bold ${item.tone}`}>{item.value}</p> </div> ))}
  </div> <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]"> <div className="rounded-xl border border-[#EAEAEA] p-4"> <h3 className="text-sm font-semibold text-[#1A1A1A]">{t('accounting.invoices.detail.overview')}</h3> <div className="mt-4 grid grid-cols-2 gap-4 text-sm"> <div> <p className="text-[#787774]">{t('accounting.invoices.detail.createdBy')}</p> <p className="font-medium">{invoice.createdBy ?? '-'}</p> </div> {invoice.issuedBy && (
  <div> <p className="text-[#787774]">{t('accounting.invoices.detail.issuedBy')}</p> <p className="font-medium">{invoice.issuedBy}</p> </div> )}
  <div> <p className="text-[#787774]">{t('accounting.invoices.contact')}</p> <p className="font-medium">{invoice.contact?.name ?? invoice.guestName ?? invoice.contactId}</p> </div> {invoice.roomNumber && (
  <div> <p className="text-[#787774]">{t('accounting.invoices.roomNumber')}</p> <p className="font-medium">{invoice.roomNumber}</p> </div> )}
  {invoice.guestName && (
  <div> <p className="text-[#787774]">{t('accounting.invoices.wizard.guestName')}</p> <p className="font-medium">{invoice.guestName}</p> </div> )}
  {invoice.companyName && (
  <div> <p className="text-[#787774]">{t('accounting.invoices.wizard.companyName')}</p> <p className="font-medium">{invoice.companyName}</p> </div> )}
  <div> <p className="text-[#787774]">{t('accounting.invoices.issueDate')}</p> <p className="font-medium">{formatDate(invoice.issueDate, locale)}</p> </div> <div> <p className="text-[#787774]">{t('accounting.invoices.dueDate')}</p> <p className="font-medium">{formatDate(invoice.dueDate, locale)}</p> </div> {invoice.issuedAt && (
  <div> <p className="text-[#787774]">{t('accounting.invoices.detail.issuedAt')}</p> <p className="font-medium">{formatDateTime(invoice.issuedAt, locale)}</p> </div> )}
  {invoice.paidAt && (
  <div> <p className="text-[#787774]">{t('accounting.invoices.paidAt')}</p> <p className="font-medium">{formatDateTime(invoice.paidAt, locale)}</p> </div> )}
  </div> </div> <div className="rounded-xl border border-[#EAEAEA] p-4"> <h3 className="text-sm font-semibold text-[#1A1A1A]">{t('accounting.invoices.detail.auditHistory')}</h3> {timeline.length === 0 ? (
  <p className="mt-4 text-sm text-[#787774]">{t('accounting.invoiceEvents.noEvents')}</p> ) : (
  <div className="mt-4 space-y-3"> {timeline.map((item) => (
  <div key={item.id} className="flex gap-3 text-sm"> <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#1A1A1A]" /> <div className="min-w-0 flex-1"> <div className="flex items-start justify-between gap-3"> <p className="font-medium text-[#333333]">{item.kind}</p> {item.amount !== 0 && (
  <span className={item.amount < 0 ? 'text-[#9F2F2D]' : 'text-[#346538]'}> {item.amount> 0 ? '+' : ''}{formatCurrency(item.amount, from)}
  </span> )}
  </div> {item.description && <p className="truncate text-xs text-[#787774]">{item.description}</p>}
  {item.date && <p className="text-xs text-[#787774]">{formatDate(item.date, locale)}</p>}
  </div> </div> ))}
  </div> )}
  </div> </div> {invoice.billingAddress && (
  <div className="rounded-xl border border-[#EAEAEA] p-4 text-sm"> <p className="text-[#787774]">{t('accounting.invoices.billingAddress')}</p> <p className="mt-1 font-medium">{invoice.billingAddress}</p> </div> )}

  <div className="rounded-xl border border-[#EAEAEA] p-4"> <div className="space-y-2 text-sm"> <div className="flex justify-between"> <span className="text-[#787774]">{t('accounting.invoices.subtotal')}</span> <span>{formatCurrency(invoice.subtotal, from)}</span> </div> {invoice.discount> 0 && (
  <div className="flex justify-between"> <span className="text-[#787774]">{t('accounting.invoices.discount')}</span> <span className="text-[#9F2F2D]">-{formatCurrency(invoice.discount, from)}</span> </div> )}
  {invoice.taxAmount> 0 && (
  <div className="flex justify-between"> <span className="text-[#787774]">{t('accounting.invoices.tax')}</span> <span>{formatCurrency(invoice.taxAmount, from)}</span> </div> )}
  {invoice.serviceCharge> 0 && (
  <div className="flex justify-between"> <span className="text-[#787774]">{t('accounting.invoices.serviceCharge')}</span> <span>{formatCurrency(invoice.serviceCharge, from)}</span> </div> )}
  <div className="flex justify-between border-t pt-2 text-base font-semibold"> <span>{t('accounting.invoices.total')}</span> <MoneyAmount inline amount={invoice.amount} currency={from} /> </div> <div className="flex justify-between"> <span className="text-[#346538]">{t('accounting.invoices.paid')}</span> <span className="text-[#346538]">{formatCurrency(invoice.paidAmount, from)}</span> </div> {invoice.refundedAmount> 0 && (
  <div className="flex justify-between"> <span className="text-[#9F2F2D]">{t('accounting.invoices.refund')}</span> <span className="text-[#9F2F2D]">{formatCurrency(invoice.refundedAmount, from)}</span> </div> )}
  <div className="flex justify-between"> <span className={invoice.remainingBalance> 0 ? 'text-amber-600' : 'text-[#787774]'}> {t('accounting.invoices.detail.outstandingBalance')}
  </span> <span className={invoice.remainingBalance> 0 ? 'font-medium text-amber-600' : ''}> <MoneyAmount inline amount={invoice.remainingBalance} currency={from} />
  </span> </div> </div> </div> {(invoice.publicNotes || invoice.internalNotes || invoice.voidReason) && (
  <div className="space-y-2 border-t pt-4 text-sm"> {invoice.publicNotes && (
  <div className="rounded-lg bg-[#F9F9F8] p-3"> <p className="text-xs text-[#787774]">{t('accounting.invoices.publicNotes')}</p> <p className="mt-1">{invoice.publicNotes}</p> </div> )}
  {invoice.internalNotes && (
  <div className="rounded-lg bg-[#F9F9F8] p-3"> <p className="text-xs text-[#787774]">{t('accounting.invoices.internalNotes')}</p> <p className="mt-1 text-[#555555]">{invoice.internalNotes}</p> </div> )}
  {invoice.voidReason && (
  <div className="rounded-lg border border-[#FDEBEC] bg-[#FDEBEC] p-3"> <p className="text-xs text-[#9F2F2D]">{t('accounting.invoices.voidReason')}</p> <p className="mt-1 text-[#9F2F2D]">{invoice.voidReason}</p> </div> )}
  </div> )}
  </div> )
}
