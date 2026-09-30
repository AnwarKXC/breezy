'use client'

import { useEffect, useRef } from 'react'
import type { Invoice } from '../types/invoiceTypes'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useLocale } from '@/i18n/components/LocaleContext'
import { formatDate, formatDateTime } from '@/shared/utils/date'

interface InvoiceModalProps {
  invoice: Invoice
  labels: Record<string, string>
  onClose: () => void
}

function statusColor(status: string): string {
  switch (status) {
    case 'paid': return 'bg-green-50 text-green-700'
    case 'pending': return 'bg-[#FBF3DB] text-[#956400]'
    case 'overdue': return 'bg-[#FDEBEC] text-[#9F2F2D]'
    case 'cancelled': return 'bg-[#F9F9F8] text-[#787774]'
    default: return 'bg-[#F9F9F8] text-[#333333]'
  }
}

export function InvoiceModal({ invoice, labels, onClose }: InvoiceModalProps) {
  const { formatCurrency } = useCurrency()
  const locale = useLocale()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white p-6 ">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#1A1A1A]">
            {labels.invoice} #{invoice.invoiceNumber}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-[#787774] hover:bg-[#F5F5F5] hover:text-[#555555] transition-colors"
          >
            ✕
          </button>
        </div>

        <dl className="space-y-4">
          <div className="flex justify-between">
            <dt className="text-sm font-medium text-[#787774]">{labels.invoiceNumber}</dt>
            <dd className="text-sm font-semibold text-[#1A1A1A]">{invoice.invoiceNumber}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm font-medium text-[#787774]">{labels.amount}</dt>
            <dd className="text-sm font-semibold text-[#1A1A1A]">{formatCurrency(Number(invoice.amount), invoice.currency)}</dd>
          </div>
          <div className="flex justify-between items-center">
            <dt className="text-sm font-medium text-[#787774]">{labels.status}</dt>
            <dd>
              <span className={`inline-flex rounded-md px-2.5 py-0.5 text-xs font-semibold ${statusColor(invoice.status)}`}>
                {labels[invoice.status] ?? invoice.status}
              </span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm font-medium text-[#787774]">{labels.issueDate}</dt>
            <dd className="text-sm text-[#1A1A1A]">{formatDate(invoice.issueDate, locale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm font-medium text-[#787774]">{labels.dueDate}</dt>
            <dd className="text-sm text-[#1A1A1A]">{formatDate(invoice.dueDate, locale)}</dd>
          </div>
          {invoice.paidAt && (
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-[#787774]">{labels.paidAt}</dt>
              <dd className="text-sm text-[#1A1A1A]">{formatDateTime(invoice.paidAt, locale)}</dd>
            </div>
          )}
          {invoice.notes && (
            <div className="border-t border-[#EAEAEA] pt-4">
              <dt className="text-sm font-medium text-[#787774] mb-1">{labels.notes}</dt>
              <dd className="text-sm text-[#333333]">{invoice.notes}</dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#F5F5F5] px-4 py-2 text-sm font-medium text-[#333333] transition-colors hover:bg-[#EAEAEA]"
          >
            {labels.close}
          </button>
        </div>
      </div>
    </div>
  )
}
