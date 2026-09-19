'use client'

import type { MouseEvent as ReactMouseEvent } from 'react'
import { getMonthWeeks, strongestStatus, type DayBooking } from '../utils/dayMap'
import { monthLabel, statusBucket } from '../utils/occupancy'
import type { YearViewStatus } from '../types'

const STATUS_DOT_CLASS: Record<YearViewStatus, string> = {
  confirmed: 'bg-blue-500',
  checked_in: 'bg-emerald-500',
  checked_out: 'bg-gray-400',
  other: 'bg-amber-500',
}

const TINT_CLASS: Record<YearViewStatus, string> = {
  confirmed: 'bg-blue-50',
  checked_in: 'bg-emerald-50',
  checked_out: 'bg-gray-100',
  other: 'bg-amber-50',
}

export const MAX_DOTS = 6

interface MonthCalendarCardProps {
  year: number
  monthIndex: number
  locale: string
  bookingsByDate: Map<string, DayBooking[]>
  todayIso: string
  activeDate: string | null
  stats: { stays: number; roomNights: number }
  onDayEnter: (iso: string, rect: DOMRect) => void
  onDayLeave: () => void
  onDayClick: (iso: string, rect: DOMRect) => void
}

export function MonthCalendarCard({
  year,
  monthIndex,
  locale,
  bookingsByDate,
  todayIso,
  activeDate,
  stats,
  onDayEnter,
  onDayLeave,
  onDayClick,
}: MonthCalendarCardProps) {
  const weeks = getMonthWeeks(year, monthIndex)
  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  // Jan 1–7 2024 are Monday..Sunday
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFormatter.format(new Date(Date.UTC(2024, 0, 1 + i))))
  const monthName = monthLabel(year, monthIndex, locale)

  return (
    <section data-cal-month={monthIndex} className="rounded-xl border border-[#EAEAEA] bg-white p-3">
      <h3 className="text-sm font-semibold text-[#1A1A1A]">{monthName}</h3>
      <p className="mb-2 text-[11px] font-medium text-[#787774]">
        {stats.stays} · {stats.roomNights}
      </p>
      <div className="grid grid-cols-7 gap-px bg-[#EAEAEA] text-center text-[10px] font-medium text-[#787774]" aria-hidden="true">
        {weekdays.map((day) => (
          <div key={day} className="bg-white py-1">
            {day}
          </div>
        ))}
      </div>
      <div data-cells className="grid grid-cols-7 gap-px bg-[#EAEAEA]">
        {weeks.flat().map((cell, idx) => {
          if (!cell.iso || cell.dayNumber === null) {
            return <div key={`pad-${idx}`} className="min-h-[56px] bg-white" aria-hidden="true" />
          }
          const iso = cell.iso
          const bookings = bookingsByDate.get(iso) ?? []
          const tint = strongestStatus(bookings)
          const dow = new Date(`${iso}T00:00:00Z`).getUTCDay()
          const isWeekend = dow === 5 || dow === 6
          const visible = bookings.slice(0, MAX_DOTS)
          const overflow = bookings.length - visible.length

          function handleClick(e: ReactMouseEvent<HTMLButtonElement>) {
            e.stopPropagation()
            onDayClick(iso!, e.currentTarget.getBoundingClientRect())
          }

          return (
            <button
              key={iso}
              type="button"
              data-day={iso}
              aria-label={`${cell.dayNumber} ${monthName} — ${bookings.length} reservations`}
              onMouseEnter={(e) => onDayEnter(iso!, e.currentTarget.getBoundingClientRect())}
              onFocus={(e) => onDayEnter(iso!, e.currentTarget.getBoundingClientRect())}
              onMouseLeave={onDayLeave}
              onBlur={onDayLeave}
              onClick={handleClick}
              className={`min-h-[56px] p-1 text-left align-top transition-colors ${
                tint ? TINT_CLASS[tint] : isWeekend ? 'bg-[#FAFAF9]' : 'bg-white'
              } ${iso === todayIso ? 'ring-2 ring-inset ring-[#1A1A1A]' : ''} ${
                activeDate === iso ? 'outline outline-2 outline-offset-[-2px] outline-[#1A1A1A]' : ''
              } hover:bg-[#F0EFED]`}
            >
              <span className="block text-[11px] font-medium tabular-nums text-[#1A1A1A]">{cell.dayNumber}</span>
              {bookings.length > 0 && (
                <span className="mt-1 flex flex-wrap items-center gap-x-0.5 gap-y-1">
                  {visible.map((booking, i) => (
                    <span key={`${booking.roomId}-${i}`} className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT_CLASS[statusBucket(booking.status)]}`} />
                  ))}
                  {overflow > 0 && <span className="text-[9px] font-medium leading-none text-[#555555]">+{overflow}</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
