'use client'

import { useMemo, useCallback, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/i18n/components/LocaleContext'
import { Card } from '@/shared/components/Card'
import type { Booking } from '@/modules/bookings/types'

interface BookingsSectionProps {
  bookings: Booking[]
  labels: Record<string, string>
  onExportCsv?: () => void
  onExportPdf?: () => void
  onBook?: () => void
  onDeleteBookings?: (bookingIds: string[], firstBookingId: string) => Promise<void>
  onPrintInvoice?: (firstBookingId: string) => void
  filterYear?: number
  filterMonth?: number
  onFilterChange?: (year?: number, month?: number) => void
  loading?: boolean
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function useClickOutside(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [ref, onClose])
}

function YearPicker({ value, onChange, onClose }: { value?: number; onChange: (y?: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)
  const currentYear = new Date().getFullYear()
  const [decadeStart, setDecadeStart] = useState(Math.floor((value ?? currentYear) / 10) * 10)
  const years = useMemo(() => {
    const list: number[] = []
    for (let y = decadeStart; y <= decadeStart + 9; y++) list.push(y)
    return list
  }, [decadeStart])

  return (
    <div ref={ref} className="absolute top-full left-0 z-50 mt-1 w-72 rounded-lg border border-[#EAEAEA] bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setDecadeStart((d) => d - 10)}
          className="rounded px-2 py-1 text-xs text-[#555555] hover:bg-accent/10">←</button>
        <span className="text-sm font-semibold text-[#333333]">{decadeStart} – {decadeStart + 9}</span>
        <button type="button" onClick={() => setDecadeStart((d) => d + 10)}
          className="rounded px-2 py-1 text-xs text-[#555555] hover:bg-accent/10">→</button>
      </div>
      <button type="button" onClick={() => { onChange(undefined); onClose() }}
        className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/10 ${!value ? 'bg-[#F5F5F5] font-semibold text-[#1A1A1A]' : 'text-[#555555]'}`}>
        All years
      </button>
      <div className="grid grid-cols-3 gap-1">
        {years.map((y) => (
          <button key={y} type="button" onClick={() => { onChange(y); onClose() }}
            className={`rounded-md px-2 py-1.5 text-sm text-center transition-colors ${
              value === y ? 'bg-accent/10 font-semibold text-accent-ink' : 'text-[#555555] hover:bg-accent/10'
            }`}>
            {y}
          </button>
        ))}
      </div>
    </div>
  )
}

function MonthPicker({ value, onChange, onClose }: { value?: number; onChange: (m?: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)

  return (
    <div ref={ref} className="absolute top-full left-0 z-50 mt-1 w-44 rounded-lg border border-[#EAEAEA] bg-white py-1 shadow-lg">
      <button type="button" onClick={() => { onChange(undefined); onClose() }}
        className={`w-full px-3 py-1.5 text-left text-sm hover:bg-accent/10 ${!value ? 'font-semibold text-[#1A1A1A]' : 'text-[#555555]'}`}>
        All months
      </button>
      {MONTH_NAMES.map((name, i) => (
        <button key={i + 1} type="button" onClick={() => { onChange(i + 1); onClose() }}
          className={`w-full px-3 py-1.5 text-left text-sm hover:bg-accent/10 ${value === i + 1 ? 'font-semibold text-[#1A1A1A] bg-[#F9F9F8]' : 'text-[#555555]'}`}>
          {name}
        </button>
      ))}
    </div>
  )
}

function statusColor(status: string): string {
  switch (status) {
    case 'confirmed': return 'bg-blue-50 text-blue-700'
    case 'checked-in': return 'bg-green-50 text-green-700'
    case 'checked-out': return 'bg-[#F9F9F8] text-[#555555]'
    case 'cancelled': return 'bg-[#FDEBEC] text-[#9F2F2D]'
    case 'pending': return 'bg-[#FBF3DB] text-[#956400]'
    default: return 'bg-[#F9F9F8] text-[#333333]'
  }
}

function statusLabel(status: string, labels: Record<string, string>): string {
  return labels[status] ?? status
}

interface ReservationGroup {
  key: string
  firstBookingId: string
  guestName: string
  checkIn: string
  checkOut: string
  status: string
  bookings: Booking[]
}

function groupByReservation(bookings: Booking[]): ReservationGroup[] {
  const groups = new Map<string, Booking[]>()
  for (const b of bookings) {
    const checkInStr = b.checkIn instanceof Date ? b.checkIn.toISOString().split('T')[0] : String(b.checkIn).split('T')[0]
    const checkOutStr = b.checkOut instanceof Date ? b.checkOut.toISOString().split('T')[0] : String(b.checkOut).split('T')[0]
    const key = `${b.guestName}|${checkInStr}|${checkOutStr}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(b)
  }
  return [...groups.entries()]
    .map(([, group]) => {
      const sorted = group.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber))
      const statusPriority: Record<string, number> = {
        'checked-in': 0, confirmed: 1, pending: 2, 'checked-out': 3, cancelled: 4,
      }
      const status = sorted.reduce((worst, b) =>
        (statusPriority[b.status] ?? 99) < (statusPriority[worst] ?? 99) ? b.status : worst,
        sorted[0].status,
      )
      return {
        key: sorted[0].id,
        firstBookingId: sorted[0].id,
        guestName: group[0].guestName,
        checkIn: group[0].checkIn.toISOString(),
        checkOut: group[0].checkOut.toISOString(),
        status,
        bookings: sorted,
      }
    })
    .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime())
}

export function BookingsSection({ bookings, labels, onExportCsv, onExportPdf, onBook, filterYear, filterMonth, onFilterChange, loading }: BookingsSectionProps) {
  const router = useRouter()
  const locale = useLocale()
  const groups = useMemo(() => groupByReservation(bookings), [bookings])

  const [openYear, setOpenYear] = useState(false)
  const [openMonth, setOpenMonth] = useState(false)

  const handleYearChange = useCallback((y?: number) => {
    onFilterChange?.(y, filterMonth)
  }, [onFilterChange, filterMonth])

  const handleMonthChange = useCallback((m?: number) => {
    onFilterChange?.(filterYear, m)
  }, [onFilterChange, filterYear])

  const handleClearFilter = useCallback(() => {
    onFilterChange?.(undefined, undefined)
  }, [onFilterChange])

  const yearLabel = labels.filterYear ?? 'Year'
  const monthLabel = labels.filterMonth ?? 'Month'
  const allLabel = labels.allYears ?? 'All'

  return (
    <>
      <Card padding="lg">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[#1A1A1A]">{labels.bookingsTitle}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {onFilterChange && (
              <div className="flex items-center gap-2">
                <div className="relative sm:min-w-44">
                  <button type="button" onClick={() => { setOpenYear(true); setOpenMonth(false) }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#D4D4D4] bg-white px-3 py-2 text-start text-sm text-[#333333] hover:bg-accent/10 focus:border-[#555555] focus:outline-none">
                    <span className={filterYear ? 'text-[#333333]' : 'text-[#BBBBBB]'}>{filterYear ?? yearLabel}</span>
                    <svg className="h-4 w-4 shrink-0 text-[#787774]" fill="none" viewBox="0 0 24 24">
                      <path d="m7 10 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </button>
                  {openYear && <YearPicker value={filterYear} onChange={handleYearChange} onClose={() => setOpenYear(false)} />}
                </div>
                <div className="relative sm:min-w-44">
                  <button type="button" onClick={() => { setOpenMonth(true); setOpenYear(false) }}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#D4D4D4] bg-white px-3 py-2 text-start text-sm text-[#333333] hover:bg-accent/10 focus:border-[#555555] focus:outline-none">
                    <span className={filterMonth ? 'text-[#333333]' : 'text-[#BBBBBB]'}>{filterMonth ? MONTH_NAMES[filterMonth - 1] : monthLabel}</span>
                    <svg className="h-4 w-4 shrink-0 text-[#787774]" fill="none" viewBox="0 0 24 24">
                      <path d="m7 10 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </button>
                  {openMonth && <MonthPicker value={filterMonth} onChange={handleMonthChange} onClose={() => setOpenMonth(false)} />}
                </div>
                {(filterYear || filterMonth) && (
                  <button type="button" onClick={handleClearFilter}
                    className="h-9 rounded-lg bg-[#FDEBEC] px-3 text-xs font-semibold text-[#9F2F2D] transition-colors hover:bg-[#f8d5d5]">
                    {allLabel}
                  </button>
                )}
              </div>
            )}
            {onBook && (
              <button
                type="button"
                onClick={onBook}
                className="h-9 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
              >
                + Book a Room
              </button>
            )}
            {onExportCsv && onExportPdf ? (
              <div className="flex h-9 overflow-hidden rounded-lg border border-[#EAEAEA] bg-white text-xs font-medium text-[#333333]">
                <button type="button" onClick={onExportCsv}
                  className="inline-flex items-center px-3 transition-colors hover:bg-accent/10">
                  {labels.exportCsv}
                </button>
                <button type="button" onClick={onExportPdf}
                  className="inline-flex items-center border-s border-[#EAEAEA] px-3 transition-colors hover:bg-accent/10">
                  {labels.exportPdf}
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#EAEAEA] border-t-[#333333]" />
            <span className="ml-2 text-sm text-[#787774]">Loading...</span>
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-[#787774]">{labels.noBookings}</p>
        ) : (
          <div>
            <div className="hidden gap-x-4 border-b border-[#EAEAEA] pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#787774] sm:grid sm:grid-cols-[1.4fr_1.8fr_1.4fr_auto]">
              <span>{labels.guestName}</span>
              <span>{labels.roomNumber}</span>
              <span>{labels.checkIn}</span>
              <span>{labels.status}</span>
            </div>
            <div className="divide-y divide-[#EAEAEA]">
{groups.map((group) => {
                const roomNumbers = group.bookings.map((b) => b.roomNumber).join(', ')
                const first = group.bookings[0]
                const reservationId = first.reservationId
                return (
                  <div
                    key={group.key}
                    role="button"
                    tabIndex={reservationId ? 0 : -1}
                    onClick={() => {
                      if (reservationId) router.push(`/${locale}/reservations/${reservationId}`)
                    }}
                    onKeyDown={(e) => {
                      if (reservationId && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        router.push(`/${locale}/reservations/${reservationId}`)
                      }
                    }}
                    className={`grid w-full grid-cols-2 items-center gap-x-4 gap-y-1.5 py-3 text-start sm:grid-cols-[1.4fr_1.8fr_1.4fr_auto] ${reservationId ? 'cursor-pointer transition-colors hover:bg-accent/10' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (first.contactId) router.push(`/${locale}/contacts/${first.contactId}`)
                      }}
                      className="min-w-0 truncate text-start text-sm font-semibold text-[#346538] underline-offset-2 transition-colors hover:underline"
                    >
                      {group.guestName}
                    </button>
                    <span className="min-w-0 truncate text-sm text-[#787774] sm:pe-2">
                      {group.bookings.length} room{group.bookings.length > 1 ? 's' : ''}: {roomNumbers}
                    </span>
                    <span className="whitespace-nowrap text-xs text-[#787774]">
                      {first.checkIn.toLocaleDateString()} – {first.checkOut.toLocaleDateString()}
                    </span>
                    <span className="justify-self-end sm:justify-self-start">
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${statusColor(group.status)}`}>
                        {statusLabel(group.status, labels)}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
