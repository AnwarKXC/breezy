import type { OccupancyCell, YearOverviewStay, YearViewStatus } from '../types'

/** Friday + Saturday weekend. Change here only. */
const WEEKEND_DAYS = new Set([5, 6])

export type OccupancyMap = Map<string, Map<string, OccupancyCell>>

export function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Map any reservation status (incl. unknown/live-DB drift values) to a display bucket. */
export function statusBucket(status: string): YearViewStatus {
  if (status === 'checked_in' || status === 'checked_out' || status === 'confirmed') return status
  return 'other'
}

export function buildOccupancy(stays: YearOverviewStay[], year: number): OccupancyMap {
  const yearStart = `${year}-01-01`
  const yearEndExclusive = nextDay(`${year}-12-31`)
  const map: OccupancyMap = new Map()

  for (const stayItem of stays) {
    const start = stayItem.from < yearStart ? yearStart : stayItem.from
    const endExclusive = stayItem.to > yearEndExclusive ? yearEndExclusive : stayItem.to
    if (start >= endExclusive) continue

    let roomMap = map.get(stayItem.roomId)
    if (!roomMap) {
      roomMap = new Map()
      map.set(stayItem.roomId, roomMap)
    }

    for (let cursor = new Date(`${start}T00:00:00Z`); ; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const iso = cursor.toISOString().slice(0, 10)
      if (iso >= endExclusive) break
      if (!roomMap.has(iso)) {
        roomMap.set(iso, { status: statusBucket(stayItem.status), code: stayItem.code, guestName: stayItem.guestName, from: stayItem.from, to: stayItem.to })
      }
    }
  }

  return map
}

export interface DayInfo {
  iso: string
  dayNumber: number
  weekdayLabel: string
  isWeekend: boolean
  isToday: boolean
}

export function getMonthDays(year: number, monthIndex: number, todayIso: string, locale: string): DayInfo[] {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  const days: DayInfo[] = []

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(Date.UTC(year, monthIndex, day))
    const iso = date.toISOString().slice(0, 10)
    days.push({
      iso,
      dayNumber: day,
      weekdayLabel: formatter.format(date),
      isWeekend: WEEKEND_DAYS.has(date.getUTCDay()),
      isToday: iso === todayIso,
    })
  }

  return days
}

export function monthLabel(year: number, monthIndex: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, monthIndex, 1)),
  )
}

export function monthStats(
  stays: YearOverviewStay[],
  year: number,
  monthIndex: number,
): { stays: number; roomNights: number } {
  const monthStart = Date.UTC(year, monthIndex, 1)
  const monthEnd = Date.UTC(year, monthIndex + 1, 1)
  let count = 0
  let nights = 0

  for (const stayItem of stays) {
    const from = Date.parse(`${stayItem.from}T00:00:00Z`)
    const to = Date.parse(`${stayItem.to}T00:00:00Z`)
    if (from >= monthEnd || to <= monthStart) continue
    count += 1
    nights += Math.round((Math.min(to, monthEnd) - Math.max(from, monthStart)) / 86_400_000)
  }

  return { stays: count, roomNights: nights }
}
