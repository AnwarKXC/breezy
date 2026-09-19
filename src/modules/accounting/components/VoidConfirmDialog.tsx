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
  onVoided: () => void
}

export function VoidConfirmDialog({ invoice, t, onClose, onVoided }: Props) {
  const { formatCurrency } = useCurrency()
  const from = invoice.currency as CurrencyCode | undefined
  const [reason, setReason] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleVoid = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError(t('accounting.invoices.validation.voidReasonRequired'))
      return
    }
    if (confirmText !== invoice.invoiceNumber) {
      setError('Please type the invoice number to confirm')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/accounting/invoices/${invoice.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error ?? 'Failed to void invoice')
      }
      onVoided()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to void invoice')
    } finally {
      setSubmitting(false)
    }
  }, [reason, confirmText, invoice, t, onVoided])

  const canVoid = invoice.status !== 'paid'

  return (
    <Modal isOpen onClose={onClose} title={t('accounting.invoices.void')} size="md">
      <form className="space-y-4" onSubmit={handleVoid}>
        {!canVoid && (
          <div className="rounded-lg border border-red-200 bg-[#FDEBEC] p-3 text-sm text-[#9F2F2D]">
            {t('accounting.invoices.validation.cannotVoidPaid')}
          </div>
        )}

        <div className="rounded-lg border border-amber-200 bg-[#FBF3DB] p-3 text-sm text-amber-800">
          <p className="font-medium">{t('accounting.invoices.voidWarning')}</p>
          <div className="mt-2 space-y-1 text-xs text-[#956400]">
            <p>{t('accounting.invoices.invoiceNumber')}: <strong>{invoice.invoiceNumber}</strong></p>
            <p>{t('accounting.invoices.total')}: <strong>{formatCurrency(invoice.amount, from)}</strong></p>
            {invoice.paidAmount > 0 && (
              <p>{t('accounting.invoices.paid')}: <strong className="text-amber-600">{formatCurrency(invoice.paidAmount, from)}</strong></p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-[#FDEBEC] p-3 text-sm text-[#9F2F2D]">{error}</div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-[#333333]">
            {t('accounting.invoices.voidReason')} <span className="text-[#9F2F2D]">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('accounting.invoices.voidReasonPlaceholder')}
            className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
            rows={3}
            disabled={!canVoid}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#333333]">
            {t('accounting.invoices.invoiceNumber')} <span className="text-[#9F2F2D]">*</span>
          </label>
          <p className="mb-1 text-xs text-[#787774]">
            Type <strong>{invoice.invoiceNumber}</strong> to confirm voiding
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
            disabled={!canVoid}
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
            disabled={submitting || !canVoid || !reason.trim() || confirmText !== invoice.invoiceNumber}
            className="h-9 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? t('accounting.invoices.voiding') : t('accounting.invoices.void')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
