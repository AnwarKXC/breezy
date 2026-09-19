'use client'

import { countryName } from '@/shared/static/countries'
import { Modal } from '@/shared/components/Modal'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { BOOKING_STATUS_STYLES } from '../utils/roomStatusStyles'
import type { Booking } from '../types'
import type { Guest } from '@/modules/guests/types'

interface BookingDetailModalProps {
  isOpen: boolean
  onClose: () => void
  booking: Booking | null
  guest?: Guest | null
}

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function BookingDetailModal({ isOpen, onClose, booking, guest }: BookingDetailModalProps) {
  const { t, locale } = useTranslation()
  if (!booking) return null

  const style = BOOKING_STATUS_STYLES[booking.status] ?? BOOKING_STATUS_STYLES.booked

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${t('bookings.detail.title')} — ${booking.guestName}`} size="lg">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${style.badge}`}>
            {t(style.labelKey)}
          </span>
          <span className="text-xs text-[#787774]">ID: {booking.id.slice(0, 8)}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-[#787774]">{t('bookings.columns.guestName')}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{booking.guestName}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#787774]">{t('bookings.detail.room')}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{booking.roomNumber}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#787774]">{t('bookings.columns.checkIn')}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{formatDate(new Date(booking.checkIn), locale)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#787774]">{t('bookings.columns.checkOut')}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">{formatDate(new Date(booking.checkOut), locale)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#787774]">{t('bookings.detail.totalAmount')}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">${booking.totalAmount.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#787774]">{t('bookings.detail.paidAmount')}</p>
            <p className="mt-0.5 text-sm font-semibold text-[#1A1A1A]">${booking.paidAmount.toFixed(2)}</p>
          </div>
        </div>

        {guest && (
          <div className="rounded-xl border border-[#EAEAEA] bg-[#F9F9F8] p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#787774]">{t('bookings.detail.guestInfo')}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {guest.phone && (
                <div>
                  <span className="text-[#787774]">{t('guests.phone')}: </span>
                  <span className="text-[#1A1A1A]">{guest.phone}</span>
                </div>
              )}
              {guest.email && (
                <div>
                  <span className="text-[#787774]">{t('guests.email')}: </span>
                  <span className="text-[#1A1A1A]">{guest.email}</span>
                </div>
              )}
              {guest.country && (
                <div>
                  <span className="text-[#787774]">{t('guests.country')}: </span>
                  <span className="text-[#1A1A1A]">{countryName(guest.country, locale)}</span>
                </div>
              )}
              {guest.passportNumber && (
                <div>
                  <span className="text-[#787774]">{t('bookings.detail.idPassport')}: </span>
                  <span className="text-[#1A1A1A]">{guest.passportNumber}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
