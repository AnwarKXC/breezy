'use client'

import Link from 'next/link'
import type { DayBooking } from '../utils/dayMap'
import { statusBucket } from '../utils/occupancy'
import type { YearViewStatus } from '../types'

export interface DayPopoverLabels {
  confirmed: string
  checkedIn: string
  checkedOut: string
  other: string
  /** "{count} of {total} rooms occupied" */
  ofRoomsOccupied: string
}

interface DayDetailPopoverProps {
  dateIso: string
  bookings: DayBooking[]
  roomNumberById: Map<string, string>
  totalRooms: number
  locale: string
  labels: DayPopoverLabels
}

const STATUS_LABEL_KEY: Record<YearViewStatus, keyof DayPopoverLabels> = {
  confirmed: 'confirmed',
  checked_in: 'checkedIn',
  checked_out: 'checkedOut',
  other: 'other',
}

const STATUS_DOT_HEX: Record<YearViewStatus, string> = {
  confirmed: '#3B82F6',
  checked_in: '#10B981',
  checked_out: '#9CA3AF',
  other: '#F59E0B',
}

export function DayDetailPopover({ dateIso, bookings, roomNumberById, totalRooms, locale, labels }: DayDetailPopoverProps) {
  const header = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateIso}T00:00:00Z`))
  const countLine = labels.ofRoomsOccupied.replace('{count}', String(bookings.length)).replace('{total}', String(totalRooms))
  const sorted = [...bookings].sort((a, b) =>
    (roomNumberById.get(a.roomId) ?? '').localeCompare(roomNumberById.get(b.roomId) ?? '', undefined, { numeric: true }),
  )

  return (
    <div role="dialog" aria-label={`${header} · ${countLine}`} className="w-[320px] rounded-lg border border-[#EAEAEA] bg-white shadow-lg">
      <div className="border-b border-[#EAEAEA] px-3 py-2 text-xs font-semibold text-[#1A1A1A]">
        {header} · {countLine}
      </div>
      <div className="px-3 py-2">
        {sorted.map((booking, i) => (
          <div key={`${booking.roomId}-${booking.code}-${i}`} className="flex items-center justify-between gap-2 py-1 text-[11px]">
            <span className="flex items-center gap-1.5 text-[#1A1A1A]">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STATUS_DOT_HEX[statusBucket(booking.status)] }} />
              Room {roomNumberById.get(booking.roomId) ?? '?'} ·{' '}
              <Link
                href={`/${locale}/reservations/${booking.reservationId}`}
                className="underline-offset-2 hover:underline"
              >
                {booking.companyName ?? booking.guestName ?? '—'}
              </Link>
            </span>
            <span className="shrink-0 text-right text-[10px] text-[#787774]">
              {booking.code} · {labels[STATUS_LABEL_KEY[statusBucket(booking.status)]]} · {booking.from} → {booking.to}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
