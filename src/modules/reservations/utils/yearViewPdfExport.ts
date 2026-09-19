import { applyPdfFonts, getPdfMake } from '@/shared/utils/pdfMake'
import type { YearOverviewPayload } from '../types'
import { buildDayMap, indexByRoomAndDate, type DayBooking } from './dayMap'
import { getMonthDays } from './occupancy'
import { buildRoomColumns } from './roomColumns'

const GREEN = '#16A34A'
const HEADER_BG = '#F9F9F8'
const WEEKEND_BG = '#FEF3C7'
const BORDER = '#D9D9D9'
const TEXT = '#1A1A1A'
const MUTED = '#787774'

type Cell = Record<string, unknown>

function cell(text: string, extra: Cell = {}): Cell {
  return { text, ...extra }
}

function titleRow(monthName: string, colCount: number): Cell[] {
  return [
    {
      text: monthName,
      colSpan: colCount,
      fillColor: GREEN,
      color: '#FFFFFF',
      bold: true,
      alignment: 'center',
      fontSize: 12,
    },
    ...Array.from({ length: colCount - 1 }, () => ({})),
  ]
}

function groupRow(groups: Array<{ name: string; count: number }>): Cell[] {
  const row: Cell[] = [cell('', { fillColor: HEADER_BG })]
  for (const group of groups) {
    row.push(
      cell(group.name, {
        colSpan: group.count,
        fillColor: HEADER_BG,
        bold: true,
        alignment: 'center',
      }),
      ...Array.from({ length: group.count - 1 }, () => ({})),
    )
  }
  return row
}

function roomRow(numbers: string[]): Cell[] {
  return [
    cell('#', { fillColor: HEADER_BG, bold: true }),
    ...numbers.map((n) => cell(n, { fillColor: HEADER_BG, bold: true, alignment: 'center' })),
  ]
}

function dayRow(
  label: string,
  isWeekend: boolean,
  isToday: boolean,
  cells: Array<DayBooking | null>,
  typeNames: string[],
): Cell[] {
  const fill = isWeekend ? WEEKEND_BG : undefined
  const row: Cell[] = [
    cell(label, {
      fillColor: isToday ? '#FDE68A' : fill,
      bold: isToday,
      color: MUTED,
    }),
  ]
  for (let i = 0; i < cells.length; i++) {
    const booking = cells[i]
    if (booking) {
      row.push(
        cell(
          `${booking.companyName ?? booking.guestName ?? '—'}\n${typeNames[i]}`,
          { fillColor: fill, color: TEXT },
        ),
      )
    } else {
      row.push(cell('', { fillColor: fill }))
    }
  }
  return row
}

export function buildYearViewPdfContent(payload: YearOverviewPayload, locale: string): unknown[] {
  const dayMap = buildDayMap(payload.stays, payload.year)
  const bookingIndex = indexByRoomAndDate(dayMap)
  const isRTL = locale === 'ar'
  const { groups: rawGroups, typeNameById } = buildRoomColumns(payload.rooms, payload.roomTypes)
  // Mirror column order for RTL up front (groups + rooms within each group), rather
  // than reversing built cell arrays: colSpan cells require their `{}` placeholder
  // cells to immediately follow them, which a post-hoc array reverse breaks.
  const groups = isRTL
    ? [...rawGroups].reverse().map((g) => ({ ...g, rooms: [...g.rooms].reverse() }))
    : rawGroups
  const orderedRooms = groups.flatMap((g) => g.rooms)
  const typeNames = orderedRooms.map((r) => typeNameById.get(r.typeId) ?? '')
  const colCount = orderedRooms.length + 1

  const content: unknown[] = []

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const monthName = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(payload.year, monthIndex, 1)))

    const body: Cell[][] = [
      titleRow(monthName, colCount),
      groupRow(groups.map((g) => ({ name: g.name, count: g.rooms.length }))),
      roomRow(orderedRooms.map((r) => r.number)),
    ]

    for (const day of getMonthDays(payload.year, monthIndex, '', locale)) {
      const cells = orderedRooms.map((room) => bookingIndex.get(`${room.id}|${day.iso}`) ?? null)
      body.push(
        dayRow(
          `${day.dayNumber}-${monthIndex + 1}-${payload.year}`,
          day.isWeekend,
          day.isToday,
          cells,
          typeNames,
        ),
      )
    }

    content.push({
      table: {
        headerRows: 3,
        widths: [46, ...orderedRooms.map(() => '*')],
        body,
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => BORDER,
        vLineColor: () => BORDER,
      },
      ...(monthIndex < 11 ? { pageBreak: 'after' as const } : {}),
    })
  }

  return content
}

export async function downloadYearViewPdf(payload: YearOverviewPayload, locale: string): Promise<void> {
  // Arabic guest/company names can appear even in LTR reports, so always load the font.
  const pdfMake = await getPdfMake(true)
  const content = buildYearViewPdfContent(payload, locale)
  const docDef = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [8, 8, 8, 8],
    defaultStyle: {
      font: 'Arial',
      fontSize: 6.5,
      color: TEXT,
    },
    // per-cell font assignment (NotoSansArabic for Arabic runs, Arial for
    // Latin) instead of forcing one font on the whole doc: cells mix Arabic
    // labels with Latin guest/company names, and NotoSansArabic has no Latin
    // glyphs, so a blanket font produced tofu squares over Latin names.
    content: applyPdfFonts(content, locale),
  }
  pdfMake.createPdf(docDef).download(`reservations-${payload.year}.pdf`)
}
