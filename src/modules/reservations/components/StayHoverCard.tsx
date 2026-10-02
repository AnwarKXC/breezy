'use client'

import { createPortal } from 'react-dom'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { formatMoney } from '@/shared/contexts/CurrencyContext'
import type { DayBooking } from '../utils/dayMap'
import { statusBucket } from '../utils/occupancy'
import { stayLabel } from '../utils/tapeChart'
import type { YearViewStatus } from '../types'

const CARD_WIDTH = 300
const GAP = 8
/** Below this distance from the viewport top the card opens under the bar instead of above. */
const MIN_SPACE_ABOVE = 280

const STATUS_DOT: Record<YearViewStatus, string> = {
  confirmed: 'bg-blue-500',
  checked_in: 'bg-emerald-500',
  checked_out: 'bg-gray-400',
  other: 'bg-amber-500',
}

const STATUS_LABEL_KEY: Record<Exclude<YearViewStatus, 'other'>, string> = {
  confirmed: 'bookings.yearView.legendConfirmed',
  checked_in: 'bookings.yearView.legendInHouse',
  checked_out: 'bookings.yearView.legendCheckedOut',
}

function humanize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ') : '—'
}

function nightsBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export interface StayHoverTarget {
  booking: DayBooking
  roomNumber: string
  roomTypeName: string
  rect: DOMRect
}

/** Read-only stay summary shown above a tape-chart bar on hover; click the bar to open the reservation. */
export function StayHoverCard({ target, locale }: { target: StayHoverTarget; locale: string }) {
  const { t } = useTranslation()
  const { booking, roomNumber, roomTypeName, rect } = target
  const d = booking.details
  const bucket = statusBucket(booking.status)
  const statusText = bucket === 'other' ? humanize(booking.status) : t(STATUS_LABEL_KEY[bucket])
  const dateFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`))
  const money = (amount: number) => formatMoney(amount, d.currency)
  const stayNights = nightsBetween(booking.from, booking.to)
  const hasMoney = d.reservationTotal > 0 || d.roomTotal > 0
  const multiRoom = d.reservationTotal > 0 && Math.abs(d.reservationTotal - d.roomTotal) > 0.005

  const left = Math.max(GAP, Math.min(rect.left + rect.width / 2 - CARD_WIDTH / 2, window.innerWidth - CARD_WIDTH - GAP))
  const above = rect.top > MIN_SPACE_ABOVE
  const style = above
    ? { left, bottom: window.innerHeight - rect.top + GAP, width: CARD_WIDTH }
    : { left, top: rect.bottom + GAP, width: CARD_WIDTH }

  const guestLine = [
    d.adults ? `${d.adults} ${t('bookings.yearView.card.adults')}` : '',
    d.children ? `${d.children} ${t('bookings.yearView.card.children')}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return createPortal(
    <div
      role="tooltip"
      style={style}
      className="pointer-events-none fixed z-50 rounded-lg border border-[#EAEAEA] bg-white text-[11px] text-[#1A1A1A] shadow-lg print:hidden"
    >
      <div className="border-b border-[#EAEAEA] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[bucket]}`} />
          <span className="truncate text-xs font-semibold">{stayLabel(booking)}</span>
          {d.isVip && (
            <span className="ms-auto shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">VIP</span>
          )}
        </div>
        {booking.companyName && booking.guestName && <div className="mt-0.5 truncate text-[#555555]">{booking.guestName}</div>}
        <div className="mt-0.5 text-[10px] text-[#787774]">
          {booking.code} · {statusText}
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2">
        <Row label={t('bookings.yearView.card.room')} value={`${roomNumber}${roomTypeName ? ` · ${roomTypeName}` : ''}`} />
        <Row label={t('bookings.yearView.card.checkIn')} value={formatDate(booking.from)} />
        <Row
          label={t('bookings.yearView.card.checkOut')}
          value={`${formatDate(booking.to)} · ${stayNights} ${t('bookings.yearView.card.nights')}`}
        />
        {guestLine && <Row label={t('bookings.yearView.card.guests')} value={guestLine} />}
        {d.phone && <Row label={t('bookings.yearView.card.phone')} value={<span dir="ltr">{d.phone}</span>} />}
        <Row label={t('bookings.yearView.card.source')} value={humanize(booking.source)} />
      </dl>

      {hasMoney && (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-[#EAEAEA] px-3 py-2 tabular-nums">
          {d.ratePerNight > 0 && <Row label={t('bookings.yearView.card.ratePerNight')} value={money(d.ratePerNight)} alignEnd />}
          <Row label={t('bookings.yearView.card.roomTotal')} value={money(d.roomTotal)} alignEnd />
          {multiRoom && <Row label={t('bookings.yearView.card.reservationTotal')} value={money(d.reservationTotal)} alignEnd />}
          <Row label={t('bookings.yearView.card.paid')} value={money(d.paid)} alignEnd />
          <dt className="font-semibold">{t('bookings.yearView.card.balance')}</dt>
          <dd className={`text-end font-semibold ${d.balance > 0.005 ? 'text-red-600' : 'text-emerald-700'}`}>
            {d.balance > 0.005 ? money(d.balance) : t('bookings.yearView.card.paidInFull')}
          </dd>
        </dl>
      )}

      {d.note && (
        <div className="border-t border-[#EAEAEA] px-3 py-2">
          <div className="text-[10px] font-medium text-[#787774]">{t('bookings.yearView.card.notes')}</div>
          <p className="mt-0.5 line-clamp-3 text-[#333333]">{d.note}</p>
        </div>
      )}
    </div>,
    document.body,
  )
}

function Row({ label, value, alignEnd = false }: { label: string; value: React.ReactNode; alignEnd?: boolean }) {
  return (
    <>
      <dt className="text-[#787774]">{label}</dt>
      <dd className={`min-w-0 truncate ${alignEnd ? 'text-end' : ''}`}>{value}</dd>
    </>
  )
}
