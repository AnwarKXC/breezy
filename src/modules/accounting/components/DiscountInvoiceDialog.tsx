'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { Modal } from '@/shared/components/Modal'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { toast } from '@/shared/toast/toastEvents'
import type { CurrencyCode } from '@/shared/utils/types'
import type { Invoice } from '../types'

interface Props {
  invoice: Invoice
  t: (key: string) => string
  onClose: () => void
  onApplied: () => void
}

export function DiscountInvoiceDialog({ invoice, t, onClose, onApplied }: Props) {
  const { formatCurrency } = useCurrency()
  const from = invoice.currency as CurrencyCode | undefined
  const fmt = (value: number) => formatCurrency(value, from)

  const [amount, setAmount] = useState(String(invoice.discount ?? 0))
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Tax and service charge stay as issued, so the preview only moves the
  // discount and the total. The server recomputes both authoritatively.
  const subtotal = invoice.subtotal > 0
    ? invoice.subtotal
    : Math.max(0, invoice.amount + invoice.discount - invoice.taxAmount - invoice.serviceCharge)
  const grossBeforeDiscount = subtotal + invoice.taxAmount + invoice.serviceCharge
  const discount = Number(amount) || 0
  const newTotal = Math.max(0, grossBeforeDiscount - discount)
  const newBalance = Math.max(0, newTotal - invoice.paidAmount)
  const exceedsSubtotal = discount > grossBeforeDiscount
  const belowPaid = newTotal < invoice.paidAmount

  const handleApply = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError(t('accounting.invoices.validation.discountReasonRequired'))
      return
    }
    if (exceedsSubtotal) {
      setError(t('accounting.invoices.validation.discountExceedsSubtotal'))
      return
    }
    if (belowPaid) {
      setError(t('accounting.invoices.validation.discountBelowPaid'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/accounting/invoices/${invoice.id}/discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: discount, reason: reason.trim() }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Failed to apply discount')
      }
      toast.success(t('accounting.invoices.toast.discountApplied') || 'Discount applied')
      onApplied()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply discount')
    } finally {
      setSubmitting(false)
    }
  }, [reason, discount, exceedsSubtotal, belowPaid, invoice.id, t, onApplied])

  return (
    <Modal isOpen onClose={onClose} title={t('accounting.invoices.actions.applyDiscount')} size="md">
      <form className="space-y-4" onSubmit={handleApply}>
        <div className="rounded-lg border border-[#EAEAEA] bg-[#F9F9F8] p-3 text-sm text-[#333333]">
          <div className="flex items-center justify-between">
            <span className="text-[#787774]">{t('accounting.invoices.invoiceNumber')}</span>
            <strong>{invoice.invoiceNumber}</strong>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[#787774]">{t('accounting.invoices.subtotal')}</span>
            <strong>{fmt(subtotal)}</strong>
          </div>
          {invoice.paidAmount > 0 && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[#787774]">{t('accounting.invoices.paid')}</span>
              <strong>{fmt(invoice.paidAmount)}</strong>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-[#EAEAEA] pt-1">
            <span className="text-[#787774]">{t('accounting.invoices.newTotal')}</span>
            <strong>{fmt(newTotal)}</strong>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[#787774]">{t('accounting.invoices.balance')}</span>
            <strong>{fmt(newBalance)}</strong>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-[#FDEBEC] p-3 text-sm text-[#9F2F2D]">{error}</div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-[#333333]" htmlFor="invoice-discount-amount">
            {t('accounting.invoices.discount')} <span className="text-[#9F2F2D]">*</span>
          </label>
          <input
            id="invoice-discount-amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-[#787774]">{t('accounting.invoices.discountAmountHint')}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#333333]" htmlFor="invoice-discount-reason">
            {t('accounting.invoices.discountReason')} <span className="text-[#9F2F2D]">*</span>
          </label>
          <textarea
            id="invoice-discount-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('accounting.invoices.discountReasonPlaceholder')}
            className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-[#D4D4D4] px-4 text-sm font-medium text-[#333333] hover:bg-[#F9F9F8]"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting || !reason.trim() || exceedsSubtotal || belowPaid}
            className="h-9 rounded-lg bg-[#333333] px-4 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {submitting ? t('accounting.invoices.applyingDiscount') : t('accounting.invoices.actions.applyDiscount')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
