'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Modal } from '@/shared/components/Modal'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { isCurrencyCode } from '@/shared/static/currencies'
import { CURRENCY_SYMBOLS } from '@/shared/utils/types'
import type { Booking } from '../types'

const QUICK_CHARGES = [
  { label: 'Minibar', amount: 200 },
  { label: 'Laundry', amount: 150 },
  { label: 'Restaurant', amount: 350 },
  { label: 'Parking', amount: 100 },
  { label: 'Late Checkout', amount: 500 },
  { label: 'Damage Fee', amount: 0 },
]

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'visa', label: 'Visa' },
  { value: 'instapay', label: 'InstaPay' },
  { value: 'vodafone_cash', label: 'Vodafone Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
]

interface ExtraCharge {
  label: string
  amount: number
}

export interface CheckoutPaymentInfo {
  method: string
  paidAmount: number
}

export interface SavedCharge {
  id: string
  day_index: number
  day_label: string
  label: string
  amount: number
}

interface PricingBreakdown {
  roomCharges: number
  serviceCharge: number
  taxAmount: number
}

export interface InvoicePaymentSummary {
  status: string
  paidAmount: number
  remainingBalance: number
  /** Discount applied on the invoice after issue (accounting module). */
  discount?: number
}

interface CheckoutConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  booking: Booking | null
  formatCurrency: (amount: number, code?: string | null) => string
  onConfirm: (bookingId: string, extraCharges: ExtraCharge[], payment: CheckoutPaymentInfo) => Promise<void>
  savedCharges?: SavedCharge[]
  pricingBreakdown?: PricingBreakdown
  invoiceSummary?: InvoicePaymentSummary | null
  /** Reservation currency; defaults to the system currency. */
  currency?: string | null
}

export function CheckoutConfirmModal({ isOpen, onClose, booking, formatCurrency, onConfirm, savedCharges = [], pricingBreakdown, invoiceSummary, currency }: CheckoutConfirmModalProps) {
  const { t } = useTranslation()
  const { currencySymbol: systemSymbol } = useCurrency()
  // The amount is paid in the reservation's currency.
  const currencySymbol = isCurrencyCode(currency) ? CURRENCY_SYMBOLS[currency] : systemSymbol
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>(
    () => savedCharges.map((c) => ({ label: c.label, amount: c.amount }))
  )
  const [customLabel, setCustomLabel] = useState('')
  const [customAmount, setCustomAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paidAmount, setPaidAmount] = useState('')
  const [saving, setSaving] = useState(false)

  if (!booking) return null

  const isCompany = !!booking.contactId
  const totalExtra = extraCharges.reduce((s, c) => s + c.amount, 0)
  // booking.totalAmount (reservation total_amount) and invoiceSummary's
  // remainingBalance already include previously-saved extra charges, since
  // pricing_items 'extra' rows now feed both. totalExtra re-lists all of
  // those saved charges (plus any new one just typed) so it can be shown and
  // resubmitted to check-out. Adding it on top of either figure would count
  // saved extras twice, so the base must come from room+service+tax only —
  // never from booking.totalAmount or remainingBalance directly.
  const baseAmount = pricingBreakdown
    ? pricingBreakdown.roomCharges + pricingBreakdown.serviceCharge + pricingBreakdown.taxAmount
    : booking.totalAmount
  // A discount applied on the invoice after issue lives on the invoice, not
  // on the reservation pricing_items, so baseAmount still carries the
  // pre-discount figure. Deduct it here or the modal would ask the guest for
  // money the discount already cancelled.
  const invoiceDiscount = invoiceSummary ? Math.max(0, Number(invoiceSummary.discount ?? 0)) : 0
  const grandTotal = Math.max(0, baseAmount + totalExtra - invoiceDiscount)
  const paidSoFar = invoiceSummary ? Math.max(0, Number(invoiceSummary.paidAmount ?? 0)) : 0
  const fullyPaid = invoiceSummary !== null
    && Math.max(0, grandTotal - paidSoFar) <= 0
    && paidSoFar > 0
    && !['draft', 'void', 'cancelled', 'refunded'].includes(String(invoiceSummary?.status))
  const amountDue = Math.max(0, grandTotal - paidSoFar)
  const displayPaidAmount = paidAmount || String(amountDue)

  const handlePaidAmountChange = (value: string) => {
    const num = Number(value)
    if (value !== '' && !Number.isNaN(num) && num > amountDue) {
      setPaidAmount(String(amountDue))
      return
    }
    setPaidAmount(value)
  }

  const addCharge = (label: string, amount: number) => {
    setExtraCharges((prev) => [...prev, { label, amount }])
  }

  const addCustomCharge = () => {
    if (!customLabel || !customAmount) return
    addCharge(customLabel, Number(customAmount))
    setCustomLabel('')
    setCustomAmount('')
  }

  const removeCharge = (idx: number) => {
    setExtraCharges((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleConfirm = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onConfirm(booking.id, extraCharges, { method: paymentMethod, paidAmount: Number(displayPaidAmount) })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <form onSubmit={handleConfirm}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[#111]">{t('bookings.checkOutTitle')}</h2>
            <p className="mt-0.5 text-sm text-[#6B7280]">{t('bookings.guestNameWithRoom').replace('{guestName}', booking.guestName).replace('{roomNumber}', booking.roomNumber)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#787774] transition-colors hover:bg-[#F5F5F5] hover:text-[#333333]"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-4 rounded-xl bg-[#F9FAFB] px-4 py-3 text-sm">
          <div>
            <span className="text-[#6B7280]">{t('bookings.checkInDateLabel')}</span>
            <p className="mt-0.5 font-medium text-[#111]">{new Date(booking.checkIn).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-[#6B7280]">{t('bookings.checkOutDateLabel')}</span>
            <p className="mt-0.5 font-medium text-[#111]">{new Date(booking.checkOut).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-[#6B7280]">{t('bookings.nightsLabel')}</span>
            <p className="mt-0.5 font-medium text-[#111]">
              {Math.max(1, Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000))}
            </p>
          </div>
          {isCompany && (
            <div className="col-span-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {t('bookings.companyBookingPartialPayment')}
            </div>
          )}
        </div>

        <div className="mb-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">{t('bookings.extraChargesSection')}</h3>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {QUICK_CHARGES.map((qc) => (
              <button
                key={qc.label}
                type="button"
                onClick={() => addCharge(qc.label, qc.amount)}
                className="cursor-pointer rounded-full border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#6B7280] transition-all hover:border-[#111] hover:text-[#111]"
              >
                {qc.label}{qc.amount > 0 ? ` ${formatCurrency(qc.amount)}` : ''}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder={t('bookings.itemNamePlaceholder')}
              className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#111]"
            />
            <input
              type="number" inputMode="decimal" step="0.01" min={0} onWheel={(event) => event.currentTarget.blur()}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={t('bookings.amountPlaceholder')}
              className="w-28 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#111]"
            />
            <button
              type="button"
              disabled={!customLabel || !customAmount}
              onClick={addCustomCharge}
              className="cursor-pointer rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#6B7280] transition-all hover:border-[#111] hover:text-[#111] disabled:opacity-40"
            >
              {t('bookings.addExtraChargeLabel')}
            </button>
          </div>
          {extraCharges.length > 0 && (
            <div className="mt-3 space-y-1">
              {extraCharges.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-[#F9FAFB] px-3 py-2 text-sm">
                  <span className="text-[#374151]">{c.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-[#111]">{formatCurrency(c.amount)}</span>
                    <button type="button" onClick={() => removeCharge(i)} className="cursor-pointer text-xs text-[#EF4444] transition-colors hover:text-[#DC2626]">
                      {t('bookings.removeCharge')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {fullyPaid ? (
          <div className="mb-5 rounded-xl border border-[#BBE3C8] bg-[#EAF7EF] px-4 py-3">
            <p className="text-sm font-semibold text-[#346538]">{t('bookings.invoiceFullyPaid')}</p>
            {extraCharges.length > 0 && (
              <p className="mt-0.5 text-xs text-[#4B7A57]">
                {t('bookings.extrasOnlyHint').replace('{amount}', formatCurrency(totalExtra))}
              </p>
            )}
          </div>
        ) : (
        <div className="mb-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">{t('bookings.paymentSection')}</h3>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.value}
                type="button"
                onClick={() => setPaymentMethod(pm.value)}
                className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                  paymentMethod === pm.value
                    ? 'border-[#111] bg-[#111] text-white'
                    : 'border-[#E5E7EB] text-[#6B7280] hover:border-[#111] hover:text-[#111]'
                }`}
              >
                {pm.label}
              </button>
            ))}
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[#6B7280]">
              {t('common.amount')} {isCompany && <span className="text-amber-600">{t('bookings.partialAllowed')}</span>}
            </label>
            <div className="relative">
              <input
                type="number" inputMode="decimal" step="0.01" min={0} onWheel={(event) => event.currentTarget.blur()}
                max={amountDue}
                value={displayPaidAmount}
                onChange={(e) => handlePaidAmountChange(e.target.value)}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 pr-11 text-sm outline-none transition-colors focus:border-[#111]"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#9CA3AF]">{currencySymbol}</span>
            </div>
            {isCompany && Number(displayPaidAmount) < amountDue && (
              <p className="mt-1 text-xs text-amber-600">
                {t('bookings.remainingLabel').replace('{amount}', formatCurrency(amountDue - Number(displayPaidAmount)))}
              </p>
            )}
          </div>
        </div>
        )}

        <div className="mb-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">{t('bookings.invoiceBreakdown')}</h3>
          <div className="space-y-2">
            {pricingBreakdown ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#6B7280]">{t('bookings.roomChargesBreakdown')}</span>
                  <span className="font-medium text-[#111]">{formatCurrency(pricingBreakdown.roomCharges)}</span>
                </div>
                {pricingBreakdown.serviceCharge > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6B7280]">{t('bookings.serviceChargeLabel')}</span>
                    <span className="font-medium text-[#111]">{formatCurrency(pricingBreakdown.serviceCharge)}</span>
                  </div>
                )}
                {pricingBreakdown.taxAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6B7280]">{t('bookings.vatLabel')}</span>
                    <span className="font-medium text-[#111]">{formatCurrency(pricingBreakdown.taxAmount)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6B7280]">{t('bookings.roomChargesBreakdown')}</span>
                <span className="font-medium text-[#111]">{formatCurrency(booking.totalAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B7280]">{t('bookings.extraChargesBreakdown')}</span>
              <span className="font-medium text-[#111]">{formatCurrency(totalExtra)}</span>
            </div>
            {invoiceDiscount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6B7280]">{t('bookings.discountBreakdown')}</span>
                <span className="font-medium text-[#346538]">-{formatCurrency(invoiceDiscount)}</span>
              </div>
            )}
            {paidSoFar > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6B7280]">{t('bookings.paidBreakdown')}</span>
                <span className="font-medium text-[#346538]">-{formatCurrency(paidSoFar)}</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#E5E7EB] pt-3">
            <span className="text-base font-semibold text-[#111]">{t('bookings.totalBreakdown')}</span>
            <span className="text-base font-semibold text-[#111]">{formatCurrency(amountDue)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#E5E7EB] pt-4">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6]">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-lg bg-[#111] px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#1F2937] disabled:opacity-50"
          >
            {saving ? t('bookings.processingLabel') : t('bookings.confirmAndPrintInvoice')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
