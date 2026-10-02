import type { YearOverviewStay, YearOverviewStayDetails, YearViewStatus } from '../types'
import { nextDay, statusBucket } from './occupancy'

export interface DayBooking {
  roomId: string
  /** Raw reservation status; use statusBucket() for display colors */
  status: string
  code: string
  guestName: string | null
  /** Stay start, ISO date */
  from: string
  /** Stay end, exclusive ISO date */
  to: string
  source: string
  reservationId: string
  companyName: string | null
  details: YearOverviewStayDetails
}

export function buildDayMap(stays: YearOverviewStay[], year: number): Map<string, DayBooking[]> {
  const yearStart = `${year}-01-01`
  const yearEndExclusive = nextDay(`${year}-12-31`)
  const map = new Map<string, DayBooking[]>()

  for (const stay of stays) {
    const start = stay.from < yearStart ? yearStart : stay.from
    const endExclusive = stay.to > yearEndExclusive ? yearEndExclusive : stay.to
    if (start >= endExclusive) continue

    for (let cursor = new Date(`${start}T00:00:00Z`); ; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const iso = cursor.toISOString().slice(0, 10)
      if (iso >= endExclusive) break
      const booking: DayBooking = {
        roomId: stay.roomId,
        status: stay.status,
        code: stay.code,
        guestName: stay.guestName,
        from: stay.from,
        to: stay.to,
        source: stay.source,
        reservationId: stay.reservationId,
        companyName: stay.companyName,
        details: stay.details,
      }
      const list = map.get(iso)
      if (list) list.push(booking)
      else map.set(iso, [booking])
    }
  }

  return map
}

const TINT_PRECEDENCE: readonly YearViewStatus[] = ['checked_in', 'confirmed', 'checked_out', 'other']

export function strongestStatus(bookings: DayBooking[]): YearViewStatus | null {
  const buckets = bookings.map((b) => statusBucket(b.status))
  for (const status of TINT_PRECEDENCE) {
    if (buckets.includes(status)) return status
  }
  return null
}

export interface WeekCell {
  iso: string | null
  dayNumber: number | null
}

export function getMonthWeeks(year: number, monthIndex: number): WeekCell[][] {
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const firstDow = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()
  const lead = (firstDow + 6) % 7 // Monday-start offset

  const cells: WeekCell[] = []
  for (let i = 0; i < lead; i++) cells.push({ iso: null, dayNumber: null })
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: new Date(Date.UTC(year, monthIndex, d)).toISOString().slice(0, 10), dayNumber: d })
  }
  while (cells.length % 7 !== 0) cells.push({ iso: null, dayNumber: null })

  const weeks: WeekCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export function indexByRoomAndDate(dayMap: Map<string, DayBooking[]>): Map<string, DayBooking> {
  const index = new Map<string, DayBooking>()
  for (const [iso, bookings] of dayMap) {
    for (const booking of bookings) {
      index.set(`${booking.roomId}|${iso}`, booking)
    }
  }
  return index
}
