import type { YearOverviewPayload } from '../types'
import { buildDayMap, indexByRoomAndDate } from './dayMap'
import { getMonthDays } from './occupancy'
import { buildRoomColumns } from './roomColumns'

const GREEN = 'FF16A34A'
const HEADER_BG = 'FFF9F9F8'
const WEEKEND_BG = 'FFFEF3C7'
const BORDER = 'FFD9D9D9'
const MUTED = 'FF787774'
const WHITE = 'FFFFFFFF'

const THIN_BORDER = {
  top: { style: 'thin' as const, color: { argb: BORDER } },
  bottom: { style: 'thin' as const, color: { argb: BORDER } },
  left: { style: 'thin' as const, color: { argb: BORDER } },
  right: { style: 'thin' as const, color: { argb: BORDER } },
}

export async function buildYearExcelBuffer(payload: YearOverviewPayload, locale = 'en'): Promise<ArrayBuffer> {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  const ws = workbook.addWorksheet('Year')
  ws.columns = [{ width: 12 }, ...payload.rooms.map(() => ({ width: 18 }))]
  const colCount = payload.rooms.length + 1

  const dayMap = buildDayMap(payload.stays, payload.year)
  const bookingIndex = indexByRoomAndDate(dayMap)
  const { orderedRooms, groups, typeNameById } = buildRoomColumns(payload.rooms, payload.roomTypes)

  let row = 1

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const monthName = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(payload.year, monthIndex, 1)),
    )

    const title = ws.getRow(row)
    title.getCell(1).value = monthName
    title.getCell(1).font = { bold: true, size: 14, color: { argb: WHITE } }
    title.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    title.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    for (let c = 1; c <= colCount; c++) {
      const cell = title.getCell(c)
      cell.border = THIN_BORDER
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    }
    ws.mergeCells(row, 1, row, colCount)
    row += 1

    const groupHeader = ws.getRow(row)
    groupHeader.getCell(1).border = THIN_BORDER
    groupHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
    let groupCol = 2
    for (const group of groups) {
      const cell = groupHeader.getCell(groupCol)
      cell.value = group.name
      cell.font = { bold: true }
      cell.alignment = { horizontal: 'center' }
      cell.border = THIN_BORDER
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
      for (let c = groupCol + 1; c < groupCol + group.rooms.length; c++) {
        groupHeader.getCell(c).border = THIN_BORDER
        groupHeader.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
      }
      if (group.rooms.length > 1) ws.mergeCells(row, groupCol, row, groupCol + group.rooms.length - 1)
      groupCol += group.rooms.length
    }
    row += 1

    const roomHeader = ws.getRow(row)
    roomHeader.getCell(1).value = '#'
    roomHeader.getCell(1).font = { bold: true }
    roomHeader.getCell(1).border = THIN_BORDER
    roomHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
    for (let c = 0; c < orderedRooms.length; c++) {
      const cell = roomHeader.getCell(c + 2)
      cell.value = orderedRooms[c].number
      cell.font = { bold: true }
      cell.alignment = { horizontal: 'center' }
      cell.border = THIN_BORDER
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
    }
    row += 1

    for (const day of getMonthDays(payload.year, monthIndex, '', locale)) {
      const dataRow = ws.getRow(row)
      const label = dataRow.getCell(1)
      label.value = `${day.dayNumber}-${monthIndex + 1}-${payload.year}`
      label.border = THIN_BORDER
      if (day.isWeekend) label.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WEEKEND_BG } }
      if (day.isToday) label.font = { bold: true }

      for (let c = 0; c < orderedRooms.length; c++) {
        const room = orderedRooms[c]
        const cell = dataRow.getCell(c + 2)
        cell.border = THIN_BORDER
        if (day.isWeekend) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WEEKEND_BG } }
        const booking = bookingIndex.get(`${room.id}|${day.iso}`)
        if (booking) {
          const name = booking.companyName ?? booking.guestName ?? '—'
          const type = typeNameById.get(room.typeId) ?? ''
          cell.value = {
            richText: [
              { text: name, font: { color: { argb: 'FF000000' } } },
              { text: `\n${type}`, font: { color: { argb: MUTED } } },
            ],
          }
          cell.alignment = { wrapText: true, vertical: 'top' }
        }
      }
      row += 1
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}
