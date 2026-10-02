'use client'

import { Fragment, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import type { DayBooking } from '../utils/dayMap'
import { monthLabel, statusBucket } from '../utils/occupancy'
import { buildTapeMonth, occupancyPercent, stayLabel } from '../utils/tapeChart'
import type { YearOverviewRoom, YearOverviewRoomType, YearViewStatus } from '../types'

const DRAG_THRESHOLD = 4

/** Light fill + dark text stays legible on mono printers; the start marker matches the legend swatch. */
const BAR_CLASS: Record<YearViewStatus, string> = {
  confirmed: 'bg-blue-100 text-blue-950 border-blue-500',
  checked_in: 'bg-emerald-100 text-emerald-950 border-emerald-500',
  checked_out: 'bg-gray-200 text-gray-800 border-gray-400',
  other: 'bg-amber-100 text-amber-950 border-amber-500',
}

interface SheetViewProps {
  year: number
  monthIndex: number
  locale: string
  rooms: YearOverviewRoom[]
  roomTypes: YearOverviewRoomType[]
  bookingIndex: Map<string, DayBooking>
  todayIso: string
}

export function SheetView({ year, monthIndex, locale, rooms, roomTypes, bookingIndex, todayIso }: SheetViewProps) {
  const { t } = useTranslation()
  const { days, groups, occupiedByDay, totalRooms, totalNights } = buildTapeMonth(
    year,
    monthIndex,
    rooms,
    roomTypes,
    bookingIndex,
    todayIso,
    locale,
  )
  const monthName = monthLabel(year, monthIndex, locale)
  // Arabic short weekdays are full words; narrow keeps the 31 day columns compact.
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: locale === 'ar' ? 'narrow' : 'short', timeZone: 'UTC' })
  const colCount = days.length + 2

  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const [dragging, setDragging] = useState(false)

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.pointerType !== 'mouse') return
    const el = scrollRef.current
    if (!el) return
    dragRef.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current
    const drag = dragRef.current
    if (!el || !drag) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
      drag.moved = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    el.scrollLeft = drag.left - dx
    el.scrollTop = drag.top - dy
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(false)
  }

  // Swallow the click that ends a pan so bar links do not navigate.
  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (dragRef.current?.moved) {
      event.preventDefault()
      event.stopPropagation()
    }
    dragRef.current = null
  }

  function dayCellTone(index: number) {
    const day = days[index]
    if (day.isToday) return 'bg-amber-50'
    if (day.isWeekend) return 'bg-[#F5F5F4]'
    return ''
  }

  return (
    <section data-sheet className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white print:rounded-none print:border-0">
      <h3 className="flex items-baseline justify-between gap-3 border-b border-[#EAEAEA] px-4 py-3 text-base font-semibold text-[#1A1A1A] print:px-0 print:py-1 print:text-sm">
        <span>{monthName}</span>
        <span className="text-xs font-medium text-[#787774] tabular-nums">
          {t('bookings.yearView.rowOccupancy')}: {occupancyPercent(totalNights, totalRooms * days.length)}% · {totalNights}{' '}
          {t('bookings.yearView.colNights')}
        </span>
      </h3>
      <div
        ref={scrollRef}
        data-sheet-scroll
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        onDragStart={(event) => event.preventDefault()}
        className={`max-h-[70vh] overflow-auto ${dragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
      >
        <table className="w-full min-w-[1180px] table-fixed border-collapse text-[11px] print:min-w-0 print:text-[7.5px]">
          <colgroup>
            <col className="w-[72px] print:w-[44px]" />
            {days.map((day) => (
              <col key={day.iso} />
            ))}
            <col className="w-[52px] print:w-[34px]" />
          </colgroup>
          <thead>
            <tr>
              <th className="sticky start-0 top-0 z-30 border-b border-[#EAEAEA] bg-[#F9F9F8] px-2 py-1.5 text-start text-xs font-medium text-[#787774] print:px-1 print:text-[7.5px]">
                {t('bookings.yearView.colRoom')}
              </th>
              {days.map((day, i) => (
                <th
                  key={day.iso}
                  className={`sticky top-0 z-20 border-b border-s border-[#EAEAEA] px-0 py-1 text-center font-medium leading-tight ${
                    day.isToday ? 'bg-amber-100 text-[#1A1A1A]' : day.isWeekend ? 'bg-[#EFEFED] text-[#555555]' : 'bg-[#F9F9F8] text-[#787774]'
                  }`}
                >
                  <div className="truncate text-[10px] font-normal print:text-[6.5px]">{weekdayFormat.format(new Date(`${days[i].iso}T00:00:00Z`))}</div>
                  <div className="text-xs font-semibold tabular-nums text-[#1A1A1A] print:text-[8px]">{day.dayNumber}</div>
                </th>
              ))}
              <th className="sticky top-0 z-20 border-b border-s border-[#EAEAEA] bg-[#F9F9F8] px-1 py-1.5 text-center text-[10px] font-medium text-[#787774] print:text-[6.5px]">
                {t('bookings.yearView.colNights')}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={`${group.typeId}-${group.rows[0].room.id}`}>
                <tr className="break-after-avoid">
                  <th colSpan={colCount} className="border-t border-[#EAEAEA] bg-[#FBFBFA] p-0 text-start">
                    <span className="sticky start-0 inline-block px-2 py-1 text-[11px] font-semibold text-[#1A1A1A] print:px-1 print:py-0.5 print:text-[7.5px]">
                      {group.name} <span className="font-normal text-[#787774]">({group.rows.length})</span>
                    </span>
                  </th>
                </tr>
                {group.rows.map(({ room, segments, nights }) => (
                  <tr key={room.id} className="break-inside-avoid">
                    <th
                      scope="row"
                      className="sticky start-0 z-10 border-t border-[#EAEAEA] bg-white px-2 text-start text-xs font-semibold tabular-nums text-[#1A1A1A] print:px-1 print:text-[8px]"
                    >
                      {room.number}
                    </th>
                    {segments.map((segment) => {
                      if (!segment.booking) {
                        return (
                          <td
                            key={segment.startIndex}
                            className={`h-8 border-s border-t border-[#EAEAEA] print:h-[15px] ${dayCellTone(segment.startIndex)}`}
                          />
                        )
                      }
                      const booking = segment.booking
                      const label = stayLabel(booking)
                      return (
                        <td key={segment.startIndex} colSpan={segment.span} className="h-8 border-s border-t border-[#EAEAEA] p-0.5 print:h-[15px] print:p-px">
                          <Link
                            href={`/${locale}/reservations/${booking.reservationId}`}
                            data-tooltip={`${label} · ${booking.code} · ${booking.from} → ${booking.to}`}
                            className={`flex h-full items-center overflow-hidden px-1.5 font-medium leading-none hover:brightness-95 print:px-0.5 ${BAR_CLASS[statusBucket(booking.status)]} ${
                              segment.openStart ? '' : 'rounded-s-md border-s-[3px] print:border-s-2'
                            } ${segment.openEnd ? '' : 'rounded-e-md'}`}
                          >
                            <span className="truncate">{label}</span>
                          </Link>
                        </td>
                      )
                    })}
                    <td className="border-s border-t border-[#EAEAEA] text-center tabular-nums text-[#555555]">{nights || ''}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
          <tfoot className="text-[10px] tabular-nums print:text-[6.5px]">
            <tr className="break-inside-avoid">
              <th className="sticky start-0 z-10 border-t-2 border-[#D9D9D9] bg-[#F9F9F8] px-2 py-1 text-start font-medium text-[#555555] print:px-1">
                {t('bookings.yearView.rowOccupied')}
              </th>
              {occupiedByDay.map((count, i) => (
                <td key={days[i].iso} className="border-s border-t-2 border-[#D9D9D9] bg-[#F9F9F8] py-1 text-center font-semibold text-[#1A1A1A]">
                  {count}
                </td>
              ))}
              <td className="border-s border-t-2 border-[#D9D9D9] bg-[#F9F9F8] py-1 text-center font-semibold text-[#1A1A1A]">{totalNights}</td>
            </tr>
            <tr className="break-inside-avoid">
              <th className="sticky start-0 z-10 border-t border-[#EAEAEA] bg-[#F9F9F8] px-2 py-1 text-start font-medium text-[#555555] print:px-1">
                {t('bookings.yearView.rowOccupancy')}
              </th>
              {occupiedByDay.map((count, i) => (
                <td key={days[i].iso} className="border-s border-t border-[#EAEAEA] bg-[#F9F9F8] py-1 text-center text-[#555555]">
                  {occupancyPercent(count, totalRooms)}%
                </td>
              ))}
              <td className="border-s border-t border-[#EAEAEA] bg-[#F9F9F8] py-1 text-center font-semibold text-[#1A1A1A]">
                {occupancyPercent(totalNights, totalRooms * days.length)}%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
