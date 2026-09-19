'use client'

import { useEffect, useState, useCallback } from 'react'
import { usePayments } from '../hooks'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../types'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import type { CurrencyCode } from '@/shared/utils/types'
import { useEscapeKey } from '@/shared/hooks/useEscapeKey'

interface InvoicePaymentsModalProps {
  invoiceId: string
  invoiceAmount: number
  currency?: string
  contactName: string
  onClose: () => void
  onPaymentChanged?: () => void
  t: (key: string) => string
}

export function InvoicePaymentsModal({ invoiceId, invoiceAmount, currency, contactName, onClose, onPaymentChanged, t }: InvoicePaymentsModalProps) {
  const { formatCurrency } = useCurrency()
  const from = currency as CurrencyCode | undefined
  const fmt = (n: number) => formatCurrency(n, from)
  const { payments, load, create, remove } = usePayments(invoiceId)
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<PaymentMethod>('cash')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [load])
  useEscapeKey(onClose, !submitting)

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const balance = invoiceAmount - totalPaid
  const payableBalance = Math.max(0, balance)
  const paymentAmount = Number(amount || 0)
  const remainingAfterPayment = Math.max(0, payableBalance - Math.min(paymentAmount, payableBalance))

  const handleAmountChange = useCallback((value: string) => {
    if (value === '') {
      setAmount('')
      return
    }

    const nextAmount = Number(value)
    if (!Number.isFinite(nextAmount)) return
    setAmount(String(Math.min(Math.max(0, nextAmount), payableBalance)))
  }, [payableBalance])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const nextAmount = Number(amount)
    if (!Number.isFinite(nextAmount) || nextAmount <= 0 || nextAmount > payableBalance) return
    setSubmitting(true)
    try {
      await create({ invoice_id: invoiceId, amount: nextAmount, method: type, description: description || null })
      setAmount('')
      setDescription('')
      onPaymentChanged?.()
      onClose()
    } catch { /* handled */ }
    finally { setSubmitting(false) }
  }, [submitting, amount, payableBalance, create, invoiceId, type, description, onClose, onPaymentChanged])

  const handleRefund = useCallback(async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await create({ invoice_id: invoiceId, amount: -balance, method: 'cash', description: 'Refund' })
      onPaymentChanged?.()
      onClose()
    } catch { /* handled */ }
    finally { setSubmitting(false) }
  }, [submitting, create, invoiceId, balance, onClose, onPaymentChanged])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="mx-4 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {t('accounting.payments.title')} — {contactName}
          </h2>
          <button onClick={onClose} className="text-[#787774] hover:text-[#555555] text-xl">&times;</button>
        </div>

        <div className="mb-4 grid gap-2 rounded-lg bg-[#F9F9F8] p-3 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <span className="text-[#787774]">{t('accounting.invoices.total')}</span>
            <strong>{fmt(invoiceAmount)}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[#787774]">{t('accounting.payments.totalPaid')}</span>
            <strong>{fmt(totalPaid)}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[#787774]">{t('accounting.payments.balance')}</span>
            <strong>{fmt(payableBalance)}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[#787774]">{t('accounting.invoices.balance')}</span>
            <strong>{fmt(remainingAfterPayment)}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#333333] mb-1">{t('accounting.payments.amount')}</label>
              <input
                type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
                step="0.01"
                min="0.01"
                max={payableBalance}
                required
                className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                disabled={payableBalance <= 0 || submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#333333] mb-1">{t('accounting.payments.type')}</label>
              <select
                className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
                value={type}
                onChange={e => setType(e.target.value as PaymentMethod)}
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(key => (
                  <option key={key} value={key}>{PAYMENT_METHOD_LABELS[key]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333333] mb-1">{t('common.description')}</label>
            <input
              className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={submitting || paymentAmount <= 0 || paymentAmount > payableBalance || payableBalance <= 0}
            className="w-full rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white hover:bg-[#333333] disabled:opacity-50"
          >
            {submitting ? t('common.saving') : t('accounting.payments.add')}
          </button>
        </form>

        <div className="max-h-60 overflow-y-auto space-y-2">
          {payments.length === 0 && (
            <p className="text-sm text-[#787774] text-center py-4">{t('accounting.payments.noPayments')}</p>
          )}
          {payments.map(p => (
            <div key={p.id} className="flex justify-between items-center p-3 bg-[#F9F9F8] rounded-lg text-sm">
              <div>
                <span className="font-medium">{PAYMENT_METHOD_LABELS[p.method]}</span>
                {p.description && <span className="text-[#787774] ml-2">{p.description}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${Number(p.amount) < 0 ? 'text-[#9F2F2D]' : 'text-green-600'}`}>
                  {fmt(Number(p.amount))}
                </span>
                {Number(p.amount) > 0 && (
                  <button onClick={() => remove(p.id)} className="text-[#9F2F2D] hover:text-[#9F2F2D] text-xs">
                    {t('common.delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {balance < 0 && (
          <button
            onClick={handleRefund}
            disabled={submitting}
            className="mt-4 w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-[#9F2F2D] hover:bg-[#FDEBEC] disabled:opacity-50"
          >
            {t('accounting.payments.refund')} ({fmt(balance)})
          </button>
        )}
      </div>
    </div>
  )
}
