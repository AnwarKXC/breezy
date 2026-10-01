'use client'

import type { ReactNode } from 'react'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { WizardItem, WizardPayment, InvoiceBookingLookup } from '../types'
import { MoneyAmount } from '@/shared/components/MoneyTotals'

interface Props {
  t: (key: string) => string
  selectedBooking: InvoiceBookingLookup | null
  guestName: string
  companyName: string
  items: WizardItem[]
  applyDeposit: boolean
  depositAmount: number
  recordPayment: boolean
  payments: WizardPayment[]
  issueDate: string
  dueDate: string
  publicNotes: string
  internalNotes: string
  subtotal: number
  totalDiscount: number
  serviceChargeAmount: number
  taxAmount: number
  total: number
  formatCurrencyOverride?: (value: number) => string
}

export function InvoiceWizardStepConfirm({
  t, selectedBooking, guestName, companyName,
  items, applyDeposit, depositAmount, recordPayment, payments,
  issueDate, dueDate, publicNotes, internalNotes,
  subtotal, totalDiscount, serviceChargeAmount, taxAmount, total,
}: Props) {
  const { formatCurrency } = useCurrency()
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0)
  const depositApplied = applyDeposit ? depositAmount : 0
  const balanceDue = Math.max(0, total - depositApplied - totalPayments)
  const displayName = selectedBooking?.guestName ?? guestName
  const displayCompany = selectedBooking?.companyName ?? companyName
  const notes = publicNotes || internalNotes

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[#333333]">{t('accounting.invoices.wizard.confirmTitle')}</h3>

      <div className="min-w-0 rounded-lg border border-[#EAEAEA] bg-[#F9F9F8]/50 p-4 text-sm">
        <h4 className="mb-3 font-semibold text-[#333333]">{t('accounting.invoices.wizard.invoiceSummary')}</h4>
        <div className="space-y-2">
          {displayName && (
            <SummaryRow label={t('accounting.invoices.wizard.guestName')} value={displayName} />
          )}
          {displayCompany && (
            <SummaryRow label={t('accounting.invoices.wizard.companyName')} value={displayCompany} />
          )}
          {selectedBooking?.roomNumber && (
            <SummaryRow label={t('accounting.invoices.roomNumber')} value={selectedBooking.roomNumber} />
          )}
          <SummaryRow label={t('accounting.invoices.issueDate')} value={issueDate} />
          <SummaryRow label={t('accounting.invoices.dueDate')} value={dueDate} />

          <hr className="border-[#EAEAEA]" />

          <p className="text-xs font-medium text-[#787774]">{t('accounting.invoices.items')}</p>
          {items.map((item, idx) => (
            <div key={idx} className="flex min-w-0 justify-between gap-3 text-xs text-[#555555]">
              <span className="min-w-0 truncate">{item.description || `${item.type} x${item.quantity}`}</span>
              <span className="shrink-0">{formatCurrency(item.quantity * item.unitPrice)}</span>
            </div>
          ))}

          <hr className="border-[#EAEAEA]" />

          <SummaryRow label={t('accounting.invoices.subtotal')} value={formatCurrency(subtotal)} />
          {totalDiscount > 0 && (
            <SummaryRow label={t('accounting.invoices.discount')} value={`-${formatCurrency(totalDiscount)}`} valueClass="text-[#9F2F2D]" />
          )}
          {serviceChargeAmount > 0 && (
            <SummaryRow label={t('accounting.invoices.serviceCharge')} value={formatCurrency(serviceChargeAmount)} />
          )}
          {taxAmount > 0 && (
            <SummaryRow label={t('accounting.invoices.tax')} value={formatCurrency(taxAmount)} />
          )}
          <SummaryRow label={t('accounting.invoices.wizard.totalAmount')} value={<MoneyAmount inline amount={total} />} bold />

          {depositApplied > 0 && (
            <SummaryRow label={t('accounting.invoices.wizard.depositApplied')} value={formatCurrency(depositApplied)} valueClass="text-[#346538]" />
          )}
          {recordPayment && totalPayments > 0 && (
            <SummaryRow label={t('accounting.invoices.paid')} value={formatCurrency(totalPayments)} valueClass="text-[#346538]" />
          )}
          <SummaryRow
            label={t('accounting.invoices.wizard.amountDue')}
            value={<MoneyAmount inline amount={balanceDue} />}
            bold
            valueClass={balanceDue > 0 ? 'text-amber-600' : 'text-[#346538]'}
          />
        </div>

        {notes && (
          <div className="mt-3 space-y-1 rounded-lg bg-white p-2 text-xs">
            <p><span className="font-medium text-[#555555]">{t('accounting.invoices.notes')}:</span> {notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryRow({
  label, value, valueClass, bold,
}: {
  label: string
  value: ReactNode
  valueClass?: string
  bold?: boolean
}) {
  return (
    <div className="flex min-w-0 justify-between gap-3">
      <span className="min-w-0 truncate text-[#787774]">{label}</span>
      <span className={`shrink-0 ${bold ? 'font-bold' : 'font-medium'} ${valueClass ?? 'text-[#1A1A1A]'}`}>
        {value}
      </span>
    </div>
  )
}
