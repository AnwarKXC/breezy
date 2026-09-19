'use client'

import { FloatingInput, FloatingSelect } from '@/shared/components/FloatingField'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { InvoiceWizardBookingSummary } from './InvoiceWizardBookingSummary'
import type { WizardItem, WizardDiscount, InvoiceBookingLookup, InvoiceItemType } from '../types'
import { INVOICE_ITEM_TYPE_LABELS } from '../types'

interface Props {
  t: (key: string) => string
  items: WizardItem[]
  discount: WizardDiscount | null
  serviceCharge: number
  taxRate: number
  selectedBooking: InvoiceBookingLookup | null
  subtotal: number
  totalDiscount: number
  serviceChargeAmount: number
  taxAmount: number
  total: number
  formatCurrency?: (value: number) => string
  errors?: Record<string, string>
  onAddItem: (type?: InvoiceItemType) => void
  onUpdateItem: (idx: number, field: string, value: string | number) => void
  onRemoveItem: (idx: number) => void
  onAddQuickCharge: (type: InvoiceItemType, label: string, price: number, qty?: number) => void
  onSetDiscount: (discount: WizardDiscount | null) => void
  onSetServiceCharge: (value: number) => void
  onSetTaxRate: (value: number) => void
}

const QUICK_CHARGES: { type: InvoiceItemType; label: string; price: number }[] = [
  { type: 'laundry', label: 'Laundry', price: 150 },
  { type: 'minibar', label: 'Minibar', price: 200 },
  { type: 'restaurant', label: 'Restaurant', price: 350 },
  { type: 'parking', label: 'Parking', price: 100 },
  { type: 'late_checkout', label: 'Late Checkout', price: 500 },
  { type: 'extra_service', label: 'Extra Night', price: 0 },
  { type: 'damage_fee', label: 'Damage Fee', price: 0 },
]

export function InvoiceWizardStepCharges({
  t, items, discount, serviceCharge, taxRate, selectedBooking,
  subtotal, totalDiscount, serviceChargeAmount, taxAmount, total,
  errors,
  onAddItem, onUpdateItem, onRemoveItem, onAddQuickCharge,
  onSetDiscount, onSetServiceCharge, onSetTaxRate,
}: Props) {
  const { formatCurrency: fc } = useCurrency()

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[#333333]">{t('accounting.invoices.wizard.reviewChargesTitle')}</h3>

      {selectedBooking && <InvoiceWizardBookingSummary booking={selectedBooking} />}

      <div className="flex flex-wrap gap-1.5">
        {QUICK_CHARGES.map((qc) => (
          <button
            key={qc.type}
            type="button"
            onClick={() => onAddQuickCharge(qc.type, qc.label, qc.price)}
            className="rounded-md border border-[#EAEAEA] px-2.5 py-1 text-[11px] font-medium text-[#555555] transition-colors hover:border-[#D4D4D4] hover:bg-[#F9F9F8]"
          >
            + {qc.label}
          </button>
        ))}
      </div>

      <div className={`space-y-2 ${errors?.items ? 'rounded-lg border border-red-400 bg-[#FDEBEC]/30 p-3' : ''}`}>
        {errors?.items && (
          <p className="text-xs text-[#9F2F2D]">{errors.items}</p>
        )}
        {items.map((item, idx) => (
          <div key={idx} className="min-w-0 rounded-xl border border-[#EAEAEA] bg-[#F9F9F8]/60 p-3">
            <div className="grid min-w-0 gap-3">
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(9rem,0.9fr)_minmax(0,1.1fr)]">
                <FloatingSelect
                  label={t('accounting.invoices.type')}
                  wrapperClassName="min-w-0"
                  className="h-11 min-w-0 text-sm"
                  value={item.type}
                  onChange={(e) => onUpdateItem(idx, 'type', e.target.value)}
                >
                  {Object.entries(INVOICE_ITEM_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </FloatingSelect>
                <FloatingInput
                  label={t('accounting.invoices.description')}
                  wrapperClassName="min-w-0"
                  className="h-11 min-w-0 text-sm"
                  value={item.description}
                  onChange={(e) => onUpdateItem(idx, 'description', e.target.value)}
                />
              </div>
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(5.5rem,0.7fr)_minmax(6rem,0.8fr)_minmax(7rem,1fr)_2rem]">
                <FloatingInput
                  type="number" inputMode="numeric"
                  label={t('accounting.invoices.quantity')}
                  wrapperClassName="min-w-0"
                  className="h-11 min-w-0 text-sm"
                  min={0.01}
                  step="0.01"
                  value={item.quantity}
                  onChange={(e) => onUpdateItem(idx, 'quantity', Number(e.target.value))}
                />
                <FloatingInput
                  type="number" inputMode="decimal"
                  label={t('accounting.invoices.unitPrice')}
                  wrapperClassName="min-w-0"
                  className="h-11 min-w-0 text-sm"
                  step="0.01"
                  min={0}
                  value={item.unitPrice}
                  onChange={(e) => onUpdateItem(idx, 'unitPrice', Number(e.target.value))}
                />
                <div className="floating-field is-filled min-w-0">
                  <div className="form-control flex h-11 min-w-0 items-center justify-end truncate rounded-lg px-3 text-sm font-semibold text-[#333333]">
                    {fc(item.quantity * item.unitPrice)}
                  </div>
                  <span className="floating-label">{t('accounting.invoices.total')}</span>
                </div>
                {items.length > 1 && (
                  <div className="flex min-w-0 sm:items-center">
                    <button
                      type="button"
                      aria-label={t('accounting.invoices.removeItem')}
                      title={t('accounting.invoices.removeItem')}
                      onClick={() => onRemoveItem(idx)}
                      className="flex h-11 w-full items-center justify-center rounded-lg text-[#9F2F2D] hover:bg-[#FDEBEC] sm:w-8"
                    >
                      &times;
                    </button>
                  </div>
                )}
              </div>
            </div>
            {item.originalPrice != null && item.unitPrice !== item.originalPrice && (
              <p className="mt-1 text-[10px] text-amber-600">
                Price overridden from {fc(item.originalPrice)} to {fc(item.unitPrice)}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onAddItem()}
        className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
        {t('accounting.invoices.addItem')}
      </button>

      <details className="rounded-lg border border-[#EAEAEA]">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[#555555] hover:bg-[#F9F9F8]">
          {t('accounting.invoices.discount')}
        </summary>
        <div className="space-y-3 border-t border-[#EAEAEA] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[#555555]">
              {t('accounting.invoices.wizard.discountType')}
              <select
                value={discount?.type ?? 'percentage'}
                onChange={(e) =>
                  onSetDiscount({
                    type: e.target.value as 'percentage' | 'fixed',
                    value: discount?.value ?? 0,
                    reason: discount?.reason ?? '',
                    approvedBy: discount?.approvedBy ?? null,
                  })
                }
                className="mt-1 w-full rounded-lg border border-[#D4D4D4] px-2 py-1.5 text-xs"
              >
                <option value="percentage">{t('accounting.invoices.wizard.percentage')}</option>
                <option value="fixed">{t('accounting.invoices.wizard.fixed')}</option>
              </select>
            </label>
            <label className="text-xs text-[#555555]">
              {t('accounting.invoices.wizard.discountValue')}
              <input
                type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
                min={0}
                step="0.01"
                value={discount?.value ?? 0}
                onChange={(e) =>
                  onSetDiscount({
                    type: discount?.type ?? 'percentage',
                    value: Number(e.target.value),
                    reason: discount?.reason ?? '',
                    approvedBy: discount?.approvedBy ?? null,
                  })
                }
                className="mt-1 w-full rounded-lg border border-[#D4D4D4] px-2 py-1.5 text-xs"
              />
            </label>
          </div>
          <label className="text-xs text-[#555555]">
            {t('accounting.invoices.wizard.discountReason')}
            <input
              value={discount?.reason ?? ''}
              onChange={(e) =>
                onSetDiscount({
                  type: discount?.type ?? 'percentage',
                  value: discount?.value ?? 0,
                  reason: e.target.value,
                  approvedBy: discount?.approvedBy ?? null,
                })
              }
              className="mt-1 w-full rounded-lg border border-[#D4D4D4] px-2 py-1.5 text-xs"
            />
          </label>
        </div>
      </details>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-[#555555]">
          {t('accounting.invoices.wizard.serviceCharge')} (%)
          <input
            type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
            min={0}
            max={100}
            step="0.1"
            value={serviceCharge}
            onChange={(e) => onSetServiceCharge(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-[#D4D4D4] px-2 py-1.5 text-xs"
          />
        </label>
        <label className="text-xs text-[#555555]">
          {t('accounting.invoices.wizard.taxRate')} (%)
          <input
            type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
            min={0}
            max={100}
            step="0.1"
            value={taxRate}
            onChange={(e) => onSetTaxRate(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-[#D4D4D4] px-2 py-1.5 text-xs"
          />
        </label>
      </div>

      <div className="space-y-1 border-t border-[#EAEAEA] pt-3 text-sm">
        <div className="flex justify-between text-[#787774]">
          <span>{t('accounting.invoices.subtotal')}</span>
          <span>{fc(subtotal)}</span>
        </div>
        {totalDiscount > 0 && (
          <div className="flex justify-between text-[#9F2F2D]">
            <span>{t('accounting.invoices.discount')}</span>
            <span>-{fc(totalDiscount)}</span>
          </div>
        )}
        {serviceChargeAmount > 0 && (
          <div className="flex justify-between text-[#787774]">
            <span>{t('accounting.invoices.serviceCharge')}</span>
            <span>{fc(serviceChargeAmount)}</span>
          </div>
        )}
        {taxAmount > 0 && (
          <div className="flex justify-between text-[#787774]">
            <span>{t('accounting.invoices.tax')}</span>
            <span>{fc(taxAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-[#1A1A1A]">
          <span>{t('accounting.invoices.wizard.totalAmount')}</span>
          <span>{fc(total)}</span>
        </div>
      </div>
    </div>
  )
}
