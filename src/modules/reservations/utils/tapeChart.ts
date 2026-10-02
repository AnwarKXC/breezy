import type { YearOverviewRoom, YearOverviewRoomType } from '../types'
import type { DayBooking } from './dayMap'
import { getMonthDays, nextDay, type DayInfo } from './occupancy'
import { buildRoomColumns } from './roomColumns'

/** A run of consecutive days in one room row: either one stay (merged) or a single empty day. */
export interface TapeSegment {
  /** 0-based index into the month's days */
  startIndex: number
  span: number
  booking: DayBooking | null
  /** Stay started before this month (no check-in edge shown) */
  openStart: boolean
  /** Stay continues after this month (no check-out edge shown) */
  openEnd: boolean
}

export interface TapeRow {
  room: YearOverviewRoom
  segments: TapeSegment[]
  nights: number
}

export interface TapeGroup {
  typeId: string
  name: string
  rows: TapeRow[]
}

export interface TapeMonth {
  days: DayInfo[]
  groups: TapeGroup[]
  /** Occupied room count per day, aligned with `days` */
  occupiedByDay: number[]
  totalRooms: number
  totalNights: number
}

function sameStay(a: DayBooking, b: DayBooking) {
  return a.reservationId === b.reservationId && a.from === b.from && a.to === b.to
}

/**
 * Tape-chart layout for one month: rooms are rows (grouped by room type, in room-number
 * order), days are columns, and each stay collapses into one segment spanning its nights.
 * Width is bounded by the month length (max 31), so it prints on one page width no matter
 * how many rooms the hotel has.
 */
export function buildTapeMonth(
  year: number,
  monthIndex: number,
  rooms: YearOverviewRoom[],
  roomTypes: YearOverviewRoomType[],
  bookingIndex: Map<string, DayBooking>,
  todayIso: string,
  locale: string,
): TapeMonth {
  const days = getMonthDays(year, monthIndex, todayIso, locale)
  const monthStart = days[0].iso
  const monthEndExclusive = nextDay(days[days.length - 1].iso)
  const { groups: roomGroups } = buildRoomColumns(rooms, roomTypes)
  const occupiedByDay = days.map(() => 0)
  let totalNights = 0

  const groups: TapeGroup[] = roomGroups.map((group) => ({
    typeId: group.typeId,
    name: group.name,
    rows: group.rooms.map((room) => {
      const segments: TapeSegment[] = []
      let nights = 0

      for (let i = 0; i < days.length; i++) {
        const booking = bookingIndex.get(`${room.id}|${days[i].iso}`) ?? null
        if (booking) {
          nights += 1
          occupiedByDay[i] += 1
        }
        const last = segments[segments.length - 1]
        if (booking && last?.booking && sameStay(last.booking, booking)) {
          last.span += 1
          continue
        }
        segments.push({
          startIndex: i,
          span: 1,
          booking,
          openStart: booking ? booking.from < monthStart : false,
          openEnd: booking ? booking.to > monthEndExclusive : false,
        })
      }

      totalNights += nights
      return { room, segments, nights }
    }),
  }))

  return { days, groups, occupiedByDay, totalRooms: rooms.length, totalNights }
}

export function stayLabel(booking: DayBooking) {
  return booking.companyName ?? booking.guestName ?? '—'
}

export function occupancyPercent(occupied: number, total: number) {
  return total > 0 ? Math.round((occupied / total) * 100) : 0
}
