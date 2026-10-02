import type { YearOverviewPayload, YearViewStatus } from '../types'
import { buildDayMap, indexByRoomAndDate } from './dayMap'
import { monthLabel, statusBucket } from './occupancy'
import { buildTapeMonth, occupancyPercent, stayLabel } from './tapeChart'
import type { YearViewPdfLabels } from './yearViewPdfExport'

const GREEN = 'FF16A34A'
const HEADER_BG = 'FFF9F9F8'
const GROUP_BG = 'FFF1F1EF'
const WEEKEND_BG = 'FFF5F5F4'
const BORDER = 'FFD9D9D9'
const MUTED = 'FF787774'
const WHITE = 'FFFFFFFF'

const BAR_FILL: Record<YearViewStatus, string> = {
  confirmed: 'FFDBEAFE',
  checked_in: 'FFD1FAE5',
  checked_out: 'FFE5E7EB',
  other: 'FFFEF3C7',
}

const THIN_BORDER = {
  top: { style: 'thin' as const, color: { argb: BORDER } },
  bottom: { style: 'thin' as const, color: { argb: BORDER } },
  left: { style: 'thin' as const, color: { argb: BORDER } },
  right: { style: 'thin' as const, color: { argb: BORDER } },
}

function solid(argb: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } }
}

/** One worksheet per month in tape-chart layout: rooms are rows, days are columns, each stay is one merged cell. */
export async function buildYearExcelBuffer(payload: YearOverviewPayload, locale: string, labels: YearViewPdfLabels): Promise<ArrayBuffer> {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  const bookingIndex = indexByRoomAndDate(buildDayMap(payload.stays, payload.year))
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: locale === 'ar' ? 'narrow' : 'short', timeZone: 'UTC' })

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const month = buildTapeMonth(payload.year, monthIndex, payload.rooms, payload.roomTypes, bookingIndex, '', locale)
    const dayCount = month.days.length
    const colCount = dayCount + 2
    const nightsCol = colCount
    const monthName = monthLabel(payload.year, monthIndex, locale)
    const sheetName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(payload.year, monthIndex, 1)))

    const ws = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 2, rightToLeft: locale === 'ar' }],
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: '1:2',
        margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 },
      },
    })
    ws.columns = [{ width: 8 }, ...month.days.map(() => ({ width: 5 })), { width: 7 }]

    const title = ws.getRow(1)
    title.getCell(1).value = `${monthName}  ·  ${labels.occupancy} ${occupancyPercent(month.totalNights, month.totalRooms * dayCount)}%`
    title.getCell(1).font = { bold: true, size: 13, color: { argb: WHITE } }
    title.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    title.getCell(1).fill = solid(GREEN)
    ws.mergeCells(1, 1, 1, colCount)
    title.height = 22

    const header = ws.getRow(2)
    header.height = 26
    const roomHead = header.getCell(1)
    roomHead.value = labels.room
    roomHead.font = { bold: true, color: { argb: MUTED } }
    month.days.forEach((day, i) => {
      const cell = header.getCell(i + 2)
      cell.value = {
        richText: [
          { text: `${weekdayFormat.format(new Date(`${day.iso}T00:00:00Z`))}\n`, font: { size: 8, color: { argb: MUTED } } },
          { text: String(day.dayNumber), font: { bold: true } },
        ],
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.fill = solid(day.isWeekend ? 'FFEFEFED' : HEADER_BG)
    })
    const nightsHead = header.getCell(nightsCol)
    nightsHead.value = labels.nights
    nightsHead.font = { bold: true, size: 8, color: { argb: MUTED } }
    nightsHead.alignment = { horizontal: 'center', vertical: 'middle' }
    for (let c = 1; c <= colCount; c++) {
      header.getCell(c).border = THIN_BORDER
      if (c === 1 || c === nightsCol) header.getCell(c).fill = solid(HEADER_BG)
    }

    let rowNumber = 3
    for (const group of month.groups) {
      const groupRow = ws.getRow(rowNumber)
      groupRow.getCell(1).value = `${group.name} (${group.rows.length})`
      groupRow.getCell(1).font = { bold: true }
      groupRow.getCell(1).fill = solid(GROUP_BG)
      groupRow.getCell(1).border = THIN_BORDER
      ws.mergeCells(rowNumber, 1, rowNumber, colCount)
      rowNumber += 1

      for (const { room, segments, nights } of group.rows) {
        const row = ws.getRow(rowNumber)
        row.getCell(1).value = room.number
        row.getCell(1).font = { bold: true }

        for (const segment of segments) {
          const col = segment.startIndex + 2
          const cell = row.getCell(col)
          if (segment.booking) {
            cell.value = stayLabel(segment.booking)
            cell.fill = solid(BAR_FILL[statusBucket(segment.booking.status)])
            cell.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: segment.span < 3 }
            cell.note = `${segment.booking.code} · ${segment.booking.from} → ${segment.booking.to}`
            if (segment.span > 1) ws.mergeCells(rowNumber, col, rowNumber, col + segment.span - 1)
          } else if (month.days[segment.startIndex].isWeekend) {
            cell.fill = solid(WEEKEND_BG)
          }
        }

        row.getCell(nightsCol).value = nights || null
        row.getCell(nightsCol).alignment = { horizontal: 'center' }
        for (let c = 1; c <= colCount; c++) row.getCell(c).border = THIN_BORDER
        rowNumber += 1
      }
    }

    const footers: Array<[string, Array<string | number>, string | number]> = [
      [labels.occupied, month.occupiedByDay, month.totalNights],
      [
        labels.occupancy,
        month.occupiedByDay.map((count) => `${occupancyPercent(count, month.totalRooms)}%`),
        `${occupancyPercent(month.totalNights, month.totalRooms * dayCount)}%`,
      ],
    ]
    for (const [label, values, total] of footers) {
      const row = ws.getRow(rowNumber)
      row.getCell(1).value = label
      values.forEach((value, i) => {
        row.getCell(i + 2).value = value
      })
      row.getCell(nightsCol).value = total
      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c)
        cell.border = THIN_BORDER
        cell.fill = solid(HEADER_BG)
        cell.font = { bold: c === 1 || c === nightsCol, size: 8 }
        if (c > 1) cell.alignment = { horizontal: 'center' }
      }
      rowNumber += 1
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}
