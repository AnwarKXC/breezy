'use client'

import { FloatingInput } from '@/shared/components/FloatingField'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { WizardPayment, PaymentMethod } from '../types'
import { PAYMENT_METHOD_LABELS } from '../types'

interface Props {
  t: (key: string) => string
  recordPayment: boolean
  payments: WizardPayment[]
  applyDeposit: boolean
  depositAmount: number
  issueDate: string
  dueDate: string
  publicNotes: string
  internalNotes: string
  total: number
  canShowDeposit: boolean
  errors?: Record<string, string>
  onSetRecordPayment: (value: boolean) => void
  onSetPayments: (payments: WizardPayment[]) => void
  onAddPayment: () => void
  onUpdatePayment: (idx: number, field: 'amount' | 'method', value: number | PaymentMethod) => void
  onRemovePayment: (idx: number) => void
  onSetApplyDeposit: (value: boolean) => void
  onSetIssueDate: (date: string) => void
  onSetDueDate: (date: string) => void
  onSetPublicNotes: (notes: string) => void
  onSetInternalNotes: (notes: string) => void
}

export function InvoiceWizardStepPayment({
  t, recordPayment, payments, applyDeposit, depositAmount,
  issueDate, dueDate, publicNotes, internalNotes, total, canShowDeposit,
  errors,
  onSetRecordPayment, onAddPayment, onUpdatePayment, onRemovePayment,
  onSetApplyDeposit,
  onSetIssueDate, onSetDueDate, onSetPublicNotes, onSetInternalNotes,
}: Props) {
  const { formatCurrency } = useCurrency()
  const notesValue = publicNotes || internalNotes
  const depositApplied = applyDeposit ? depositAmount : 0
  const payableTotal = Math.max(0, total - depositApplied)
  const totalPayments = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const remainingDue = Math.max(0, payableTotal - totalPayments)
  const paymentLimitForIndex = (idx: number) => {
    const otherPayments = payments.reduce(
      (sum, payment, paymentIdx) => paymentIdx === idx ? sum : sum + Number(payment.amount || 0),
      0,
    )
    return Math.max(0, payableTotal - otherPayments)
  }
  const handlePaymentAmountChange = (idx: number, value: string) => {
    const nextAmount = value === '' ? 0 : Number(value)
    if (!Number.isFinite(nextAmount)) return
    onUpdatePayment(idx, 'amount', Math.min(Math.max(0, nextAmount), paymentLimitForIndex(idx)))
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[#333333]">{t('accounting.invoices.wizard.paymentNotesTitle')}</h3>

      {canShowDeposit && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={applyDeposit}
              onChange={(e) => onSetApplyDeposit(e.target.checked)}
              className="h-4 w-4 rounded border-[#D4D4D4]"
            />
            <span className="font-medium text-[#333333]">
              {t('accounting.invoices.wizard.applyDeposit')} ({formatCurrency(depositAmount)})
            </span>
          </label>
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="record-payment"
          checked={recordPayment}
          onChange={(e) => onSetRecordPayment(e.target.checked)}
          className="h-4 w-4 rounded border-[#D4D4D4]"
        />
        <label htmlFor="record-payment" className="text-sm font-medium text-[#333333]">
          {t('accounting.invoices.wizard.recordPaymentTitle')}
        </label>
      </div>

      {recordPayment && (
        <div className={`space-y-3 rounded-lg border p-4 ${errors?.payments ? 'border-red-400 bg-[#FDEBEC]/30' : 'border-[#EAEAEA] bg-[#F9F9F8]/50'}`}>
          {errors?.payments && (
            <p className="text-xs text-[#9F2F2D]">{errors.payments}</p>
          )}
          {payments.length === 0 && (
            <p className="text-xs text-[#787774]">{t('accounting.invoices.wizard.noPayments')}</p>
          )}
          {payments.map((payment, idx) => (
            <div key={idx} className="space-y-2 rounded-lg bg-white p-2">
              <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-semibold uppercase text-[#787774]">
                  {t('accounting.invoices.amount')}
                </label>
                <input
                  type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
                  step="0.01"
                  min="0.01"
                  max={paymentLimitForIndex(idx)}
                  value={payment.amount || ''}
                  onChange={(e) => handlePaymentAmountChange(idx, e.target.value)}
                  className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-semibold uppercase text-[#787774]">
                  {t('accounting.invoices.paymentMethod')}
                </label>
                <select
                  value={payment.method}
                  onChange={(e) => onUpdatePayment(idx, 'method', e.target.value as PaymentMethod)}
                  className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              {payments.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemovePayment(idx)}
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-[#9F2F2D] hover:bg-[#FDEBEC]"
                >
                  &times;
                </button>
              )}
              </div>
              <div className="flex justify-between text-[11px] text-[#787774]">
                <span>{t('accounting.payments.balance')}</span>
                <span>{formatCurrency(Math.max(0, paymentLimitForIndex(idx) - Number(payment.amount || 0)))}</span>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={onAddPayment}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            + {t('accounting.invoices.wizard.addPayment')}
          </button>
          <p className="text-xs text-[#787774]">
            {t('accounting.invoices.wizard.dueNow')}: {formatCurrency(remainingDue)}
          </p>
        </div>
      )}

      <FloatingInput
        label={t('accounting.invoices.notes')}
        value={notesValue}
        onChange={(e) => {
          onSetPublicNotes(e.target.value)
          onSetInternalNotes('')
        }}
        wrapperClassName="w-full"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#555555]">{t('accounting.invoices.issueDate')}</label>
          <input
            type="date" max={dueDate || undefined}
            value={issueDate}
            onChange={(e) => onSetIssueDate(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors?.issueDate ? 'border-red-400' : 'border-[#D4D4D4]'}`}
          />
          {errors?.issueDate && (
            <p className="mt-1 text-xs text-[#9F2F2D]">{errors.issueDate}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#555555]">{t('accounting.invoices.dueDate')}</label>
          <input
            type="date" min={issueDate || undefined}
            value={dueDate}
            onChange={(e) => onSetDueDate(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${errors?.dueDate ? 'border-red-400' : 'border-[#D4D4D4]'}`}
          />
          {errors?.dueDate && (
            <p className="mt-1 text-xs text-[#9F2F2D]">{errors.dueDate}</p>
          )}
        </div>
      </div>
    </div>
  )
}
