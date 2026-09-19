'use client'

import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Modal } from '@/shared/components/Modal'
import { useState, type FormEvent } from 'react'

interface InvoiceInfo {
  id: string
  invoiceNumber: string
  status: string
  amount: number
}

interface BookingDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onChargeBooking: () => void
  onDeleteInvoice: () => void
  onDownloadInvoice: () => void
  bookingGuestName: string
  invoice: InvoiceInfo | null
  chargeAmount?: number
  chargeInvoiceNumber?: string
  loading?: boolean
}

export function BookingDeleteModal({
  isOpen,
  onClose,
  onChargeBooking,
  onDeleteInvoice,
  onDownloadInvoice,
  bookingGuestName,
  invoice,
  chargeAmount,
  chargeInvoiceNumber,
  loading = false,
}: BookingDeleteModalProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'choice' | 'charge-confirm'>('choice')

  const handleConfirmCharge = (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    setMode('choice')
    onChargeBooking()
  }

  const handleDeleteAction = (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (invoice) {
      onDeleteInvoice()
    } else {
      onChargeBooking()
    }
  }

  if (!isOpen) return null

  if (mode === 'charge-confirm' && invoice) {
    return (
      <Modal isOpen onClose={onClose} title={t('bookings.chargeBookingTitle')} size="md">
        <form onSubmit={handleConfirmCharge} className="space-y-4">
          <p className="text-sm leading-6 text-[#555555]">
            {t('bookings.chargeBookingConfirm').replace('{name}', bookingGuestName)}
          </p>

          <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#555555]">{t('bookings.invoiceLabel')}</span>
              <button
                type="button"
                onClick={onDownloadInvoice}
                className="font-mono font-medium text-[#1A6BFF] underline hover:text-[#1552CC]"
              >
                #{chargeInvoiceNumber ?? invoice.invoiceNumber}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-[#555555]">{t('common.amount')}</span>
              <span className="font-semibold text-[#1A1A1A]">
                ${(chargeAmount ?? invoice.amount).toFixed(2)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-[#555555]">{t('common.status')}</span>
              <span className="capitalize text-[#1A1A1A]">{invoice.status.replace(/_/g, ' ')}</span>
            </div>
          </div>

          <p className="text-xs leading-5 text-[#787774]">
            {t('bookings.chargeBookingHint')}
          </p>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode('choice')}
              disabled={loading}
              className="rounded-lg border border-[#D4D4D4] px-4 py-2.5 text-sm font-semibold text-[#333333] transition-colors hover:bg-[#F9F9F8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('bookings.backLabel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? t('bookings.chargingLabel') : t('bookings.confirmCharge')}
            </button>
          </div>
        </form>
      </Modal>
    )
  }

  return (
    <Modal isOpen onClose={onClose} title={t('bookings.bookingDeleteTitle')} size="md">
      <form onSubmit={handleDeleteAction} className="space-y-4">
        <p className="text-sm leading-6 text-[#555555]">
          {t('bookings.bookingDeleteTitle')} <strong>{bookingGuestName}</strong>?
        </p>

        {invoice && (
          <div className="rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#555555]">{t('bookings.invoiceLabel')}</span>
              <button
                type="button"
                onClick={onDownloadInvoice}
                className="font-mono font-medium text-[#1A6BFF] underline hover:text-[#1552CC]"
              >
                #{invoice.invoiceNumber}
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-[#555555]">{t('common.status')}</span>
              <span className="capitalize text-[#1A1A1A]">{invoice.status.replace(/_/g, ' ')}</span>
            </div>
          </div>
        )}

        <p className="text-xs leading-5 text-[#787774]">
          {invoice
            ? t('bookings.chargeBookingWithInvoiceHint')
            : t('bookings.deleteInvoiceHint')}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-[#D4D4D4] px-4 py-2.5 text-sm font-semibold text-[#333333] transition-colors hover:bg-[#F9F9F8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>

          {invoice ? (
            <>
              <button
                type="button"
                onClick={() => setMode('charge-confirm')}
                disabled={loading}
                className="ml-auto rounded-lg border border-[#D4D4D4] px-4 py-2.5 text-sm font-semibold text-[#333333] transition-colors hover:bg-[#F9F9F8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('bookings.chargeBookingTitle')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2"
              >
                {loading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? t('bookings.deletingLabel') : t('bookings.deleteInvoiceLabel')}
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="ml-auto rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? t('bookings.deletingLabel') : t('common.delete')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
