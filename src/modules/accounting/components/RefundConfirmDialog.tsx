'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { Modal } from '@/shared/components/Modal'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { CurrencyCode } from '@/shared/utils/types'
import type { Invoice } from '../types'

interface Props {
  invoice: Invoice
  t: (key: string) => string
  onClose: () => void
  onRefunded: () => void
}

export function RefundConfirmDialog({ invoice, t, onClose, onRefunded }: Props) {
  const { formatCurrency } = useCurrency()
  // ponytail: cap at the remaining refundable amount (gross paid minus what
  // was already refunded), not the gross paid — otherwise the dialog allows
  // repeated refunds past the invoice total.
  const maxRefund = Math.max(0, invoice.paidAmount - invoice.refundedAmount)
  const from = invoice.currency as CurrencyCode | undefined
  const [amount, setAmount] = useState(String(maxRefund))
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleRefund = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const refundAmount = Number(amount)
    if (!refundAmount || refundAmount <= 0) {
      setError('Refund amount must be greater than 0')
      return
    }
    if (refundAmount > maxRefund) {
      setError(t('accounting.invoices.validation.refundAmountExceeds'))
      return
    }
    if (!reason.trim()) {
      setError('Refund reason is required')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/accounting/invoices/${invoice.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: refundAmount, reason: reason.trim() }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Failed to refund invoice')
      }
      onRefunded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refund invoice')
    } finally {
      setSubmitting(false)
    }
  }, [amount, maxRefund, reason, invoice, t, onRefunded])

  return (
    <Modal isOpen onClose={onClose} title={t('accounting.invoices.refund')} size="md">
      <form className="space-y-4" onSubmit={handleRefund}>
        <div className="rounded-lg border border-amber-200 bg-[#FBF3DB] p-3 text-sm text-amber-800">
          <p className="font-medium">{t('accounting.invoices.refundWarning')}</p>
          <div className="mt-2 space-y-1 text-xs text-[#956400]">
            <p>{t('accounting.invoices.invoiceNumber')}: <strong>{invoice.invoiceNumber}</strong></p>
            <p>{t('accounting.invoices.total')}: <strong>{formatCurrency(invoice.amount, from)}</strong></p>
            <p>{t('accounting.invoices.paid')}: <strong className="text-[#346538]">{formatCurrency(maxRefund, from)}</strong></p>
            {invoice.refundedAmount > 0 && (
              <p>{t('accounting.invoices.refund')}: <strong className="text-[#9F2F2D]">{formatCurrency(invoice.refundedAmount, from)}</strong></p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-[#FDEBEC] p-3 text-sm text-[#9F2F2D]">{error}</div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-[#333333]">
            {t('accounting.invoices.refundAmount')} <span className="text-[#9F2F2D]">*</span>
          </label>
          <input
            type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
            step="0.01"
            min="0.01"
            max={maxRefund}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-[#787774]">
            {t('accounting.invoices.remainingRefundable')}: {formatCurrency(maxRefund, from)}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#333333]">
            {t('accounting.invoices.refundReason')} <span className="text-[#9F2F2D]">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('accounting.invoices.refundReasonPlaceholder')}
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
            disabled={submitting || !Number(amount) || Number(amount) <= 0 || Number(amount) > maxRefund || !reason.trim()}
            className="h-9 rounded-lg bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? t('accounting.invoices.refunding') : t('accounting.invoices.refund')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
