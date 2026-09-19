'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import type { DayBooking } from '../utils/dayMap'
import { getMonthDays, monthLabel } from '../utils/occupancy'
import { buildRoomColumns } from '../utils/roomColumns'
import type { YearOverviewRoom, YearOverviewRoomType } from '../types'

const DRAG_THRESHOLD = 4

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
  const days = getMonthDays(year, monthIndex, todayIso, locale)
  const { orderedRooms, groups, typeNameById } = buildRoomColumns(rooms, roomTypes)
  const monthName = monthLabel(year, monthIndex, locale)

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

  // Swallow the click that ends a pan so cell links do not navigate.
  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (dragRef.current?.moved) {
      event.preventDefault()
      event.stopPropagation()
    }
    dragRef.current = null
  }

  return (
    <section data-sheet className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white">
      <h3 className="border-b border-[#EAEAEA] px-4 py-3 text-base font-semibold text-[#1A1A1A]">{monthName}</h3>
      <div
        ref={scrollRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        onDragStart={(event) => event.preventDefault()}
        className={`max-h-[70vh] overflow-auto ${dragging ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
      >
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 bg-[#F9F9F8]" aria-label="Date" />
              {groups.map((group) => (
                <th
                  key={`${group.typeId}-${group.rooms[0].id}`}
                  colSpan={group.rooms.length}
                  className="sticky top-0 z-20 border-l border-[#EAEAEA] bg-[#F9F9F8] px-2 py-1.5 text-center text-xs font-semibold text-[#1A1A1A]"
                >
                  {group.name}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 top-[30px] z-30 min-w-[92px] bg-[#F9F9F8] px-2 py-1.5 text-left text-xs font-medium text-[#787774]">
                #
              </th>
              {orderedRooms.map((room) => (
                <th
                  key={room.id}
                  className="sticky top-[30px] z-20 min-w-[110px] border-l border-[#EAEAEA] bg-[#F9F9F8] px-2 py-1.5 text-center text-xs font-medium text-[#333333]"
                >
                  {room.number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.iso} className={day.isWeekend ? 'bg-amber-50' : undefined}>
                <td
                  className={`sticky left-0 z-10 whitespace-nowrap border-t border-[#EAEAEA] px-2 py-1.5 tabular-nums ${
                    day.isToday
                      ? 'bg-amber-100 font-bold text-[#1A1A1A]'
                      : day.isWeekend
                        ? 'bg-amber-50 text-[#787774]'
                        : 'bg-white text-[#787774]'
                  }`}
                >
                  {day.dayNumber}-{monthIndex + 1}-{year}
                </td>
                {orderedRooms.map((room) => {
                  const booking = bookingIndex.get(`${room.id}|${day.iso}`)
                  const typeName = typeNameById.get(room.typeId) ?? ''
                  return (
                    <td key={room.id} className="max-w-[130px] border-l border-t border-[#EAEAEA] px-2 py-1 align-top">
                      {booking && (
                        <div className="leading-tight" title={`${booking.companyName ?? booking.guestName ?? '—'} · ${typeName}`}>
                          <Link
                            href={`/${locale}/reservations/${booking.reservationId}`}
                            className="block truncate text-[#1A1A1A] underline-offset-2 hover:underline"
                          >
                            {booking.companyName ?? booking.guestName ?? '—'}
                          </Link>
                          <div className="truncate text-[10px] text-[#787774]">{typeName}</div>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
