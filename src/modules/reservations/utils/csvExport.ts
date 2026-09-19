import type { YearOverviewPayload, YearViewStatus } from '../types'
import { buildOccupancy, getMonthDays, statusBucket } from './occupancy'

const STATUS_LABELS: Record<YearViewStatus, string> = {
  confirmed: 'CONFIRMED',
  checked_in: 'IN-HOUSE',
  checked_out: 'CHECKED-OUT',
  other: 'BOOKED',
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function buildYearCsv(payload: YearOverviewPayload, locale = 'en'): string {
  const occupancy = buildOccupancy(payload.stays, payload.year)
  const typeNameById = new Map(payload.roomTypes.map((rt) => [rt.id, rt.name]))

  const header = ['Month', 'Day', 'Weekday']
  for (const room of payload.rooms) {
    header.push(`${typeNameById.get(room.typeId) ?? ''} – ${room.number}`)
  }
  const lines = [header.map(csvEscape).join(',')]

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const monthName = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(payload.year, monthIndex, 1)),
    )
    for (const day of getMonthDays(payload.year, monthIndex, '', locale)) {
      const row = [monthName, String(day.dayNumber), day.weekdayLabel]
      for (const room of payload.rooms) {
        const cell = occupancy.get(room.id)?.get(day.iso)
        row.push(cell ? STATUS_LABELS[statusBucket(cell.status)] : '')
      }
      lines.push(row.map(csvEscape).join(','))
    }
  }

  return lines.join('\r\n')
}
