import { applyPdfFonts, getPdfMake } from '@/shared/utils/pdfMake'
import type { YearOverviewPayload, YearViewStatus } from '../types'
import { buildDayMap, indexByRoomAndDate } from './dayMap'
import { monthLabel, statusBucket } from './occupancy'
import { buildTapeMonth, occupancyPercent, stayLabel, type TapeSegment } from './tapeChart'

const GREEN = '#16A34A'
const HEADER_BG = '#F9F9F8'
const GROUP_BG = '#F1F1EF'
const WEEKEND_BG = '#F5F5F4'
const BORDER = '#D9D9D9'
const TEXT = '#1A1A1A'
const MUTED = '#787774'

/** Light fills + dark text: readable on mono printers, matches the on-screen bars. */
const BAR_FILL: Record<YearViewStatus, string> = {
  confirmed: '#DBEAFE',
  checked_in: '#D1FAE5',
  checked_out: '#E5E7EB',
  other: '#FEF3C7',
}

// A4 landscape (842pt) minus margins, split between the room column, the day columns and nights.
const PAGE_MARGIN = 14
const ROOM_COL = 36
const NIGHTS_COL = 24
const CELL_PAD_X = 1.5
const LINE_WIDTH = 0.5
const FONT_SIZE = 6
// Conservative average glyph widths (Roboto / Noto Sans Arabic) used to pre-wrap names.
const LATIN_CHAR_WIDTH = FONT_SIZE * 0.6
const ARABIC_CHAR_WIDTH = FONT_SIZE * 0.62
const ARABIC = /[\u0600-\u06FF]/

/**
 * Fixed (not '*') day widths that fill the page exactly. pdfmake grows '*' columns to fit
 * their widest unbreakable text, which pushed the table past the page edge; fixed
 * widths never grow.
 */
function dayColumnWidth(dayCount: number) {
  const columns = dayCount + 2
  const chrome = columns * CELL_PAD_X * 2 + (columns + 1) * LINE_WIDTH
  return (842 - PAGE_MARGIN * 2 - chrome - ROOM_COL - NIGHTS_COL) / dayCount
}

export interface YearViewPdfLabels {
  room: string
  nights: string
  occupied: string
  occupancy: string
}

type Cell = Record<string, unknown>

const MAX_BAR_LINES = 2

/**
 * Wrap a name into at most two explicit lines that fit the bar, shortening with "…" only
 * when it still does not fit. Lines are joined with "\n" ourselves because the Arabic font
 * pass turns spaces into non-breaking spaces, so pdfmake can never wrap Arabic names.
 */
function fitToSpan(text: string, span: number, dayWidth: number) {
  const charWidth = ARABIC.test(text) ? ARABIC_CHAR_WIDTH : LATIN_CHAR_WIDTH
  const barWidth = span * dayWidth + (span - 1) * (CELL_PAD_X * 2 + LINE_WIDTH)
  const perLine = Math.max(2, Math.floor(barWidth / charWidth))
  const cut = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max - 1)}…`)

  const lines: string[] = []
  for (const word of text.split(/\s+/).filter(Boolean).map((w) => cut(w, perLine))) {
    const last = lines.at(-1)
    if (last !== undefined && `${last} ${word}`.length <= perLine) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  if (lines.length > MAX_BAR_LINES) {
    lines.length = MAX_BAR_LINES
    lines[MAX_BAR_LINES - 1] = `${lines[MAX_BAR_LINES - 1].slice(0, perLine - 1)}…`
  }
  return lines.join('\n')
}

/** colSpan cells must be followed by `span - 1` empty placeholders. */
function spanned(cell: Cell, span: number): Cell[] {
  return [span > 1 ? { ...cell, colSpan: span } : cell, ...Array.from({ length: span - 1 }, () => ({}))]
}

function segmentCells(segment: TapeSegment, isWeekend: boolean, dayWidth: number): Cell[] {
  if (!segment.booking) return [{ text: '', fillColor: isWeekend ? WEEKEND_BG : undefined }]
  return spanned(
    {
      text: fitToSpan(stayLabel(segment.booking), segment.span, dayWidth),
      fillColor: BAR_FILL[statusBucket(segment.booking.status)],
      color: TEXT,
      alignment: 'center',
      verticalAlignment: 'middle',
    },
    segment.span,
  )
}

export function buildYearViewPdfContent(payload: YearOverviewPayload, locale: string, labels: YearViewPdfLabels): unknown[] {
  const bookingIndex = indexByRoomAndDate(buildDayMap(payload.stays, payload.year))
  // pdfmake has no RTL tables: mirror whole segments (not built cells) so each colSpan
  // cell stays immediately before its placeholders.
  const isRTL = locale === 'ar'
  const ordered = <T,>(items: T[]) => (isRTL ? [...items].reverse() : items)
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: isRTL ? 'narrow' : 'short', timeZone: 'UTC' })
  const content: unknown[] = []

  for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
    const month = buildTapeMonth(payload.year, monthIndex, payload.rooms, payload.roomTypes, bookingIndex, '', locale)
    const colCount = month.days.length + 2
    const dayWidth = dayColumnWidth(month.days.length)
    const monthNights = month.totalRooms * month.days.length

    const edgeRow = (first: Cell, days: Cell[], last: Cell) => (isRTL ? [last, ...ordered(days), first] : [first, ...days, last])

    const body: Cell[][] = [
      [
        {
          text: `${monthLabel(payload.year, monthIndex, locale)}   ·   ${labels.occupancy} ${occupancyPercent(month.totalNights, monthNights)}%`,
          colSpan: colCount,
          fillColor: GREEN,
          color: '#FFFFFF',
          bold: true,
          alignment: 'center',
          fontSize: 10,
        },
        ...Array.from({ length: colCount - 1 }, () => ({})),
      ],
      edgeRow(
        { text: labels.room, bold: true, fillColor: HEADER_BG, color: MUTED },
        month.days.map((day) => ({
          text: [
            { text: `${weekdayFormat.format(new Date(`${day.iso}T00:00:00Z`))}\n`, fontSize: 5, color: MUTED },
            { text: String(day.dayNumber), bold: true },
          ],
          alignment: 'center',
          fillColor: day.isWeekend ? '#EFEFED' : HEADER_BG,
        })),
        { text: labels.nights, bold: true, alignment: 'center', fillColor: HEADER_BG, color: MUTED, fontSize: 5 },
      ),
    ]

    for (const group of month.groups) {
      body.push(
        spanned(
          {
            text: `${group.name} (${group.rows.length})`,
            bold: true,
            fillColor: GROUP_BG,
            alignment: isRTL ? 'right' : 'left',
          },
          colCount,
        ),
      )
      for (const row of group.rows) {
        const dayCells = ordered(row.segments).flatMap((segment) => segmentCells(segment, month.days[segment.startIndex].isWeekend, dayWidth))
        const roomCell = { text: row.room.number, bold: true, verticalAlignment: 'middle' }
        const nightsCell = { text: row.nights ? String(row.nights) : '', alignment: 'center', verticalAlignment: 'middle', color: MUTED }
        // Day cells are already mirrored above; only the edge columns swap here.
        body.push(isRTL ? [nightsCell, ...dayCells, roomCell] : [roomCell, ...dayCells, nightsCell])
      }
    }

    body.push(
      edgeRow(
        { text: labels.occupied, bold: true, fillColor: HEADER_BG },
        month.occupiedByDay.map((count) => ({ text: String(count), alignment: 'center', fillColor: HEADER_BG })),
        { text: String(month.totalNights), bold: true, alignment: 'center', fillColor: HEADER_BG },
      ),
      edgeRow(
        { text: labels.occupancy, bold: true, fillColor: HEADER_BG },
        month.occupiedByDay.map((count) => ({
          text: `${occupancyPercent(count, month.totalRooms)}%`,
          alignment: 'center',
          fillColor: HEADER_BG,
          fontSize: 5,
        })),
        { text: `${occupancyPercent(month.totalNights, monthNights)}%`, bold: true, alignment: 'center', fillColor: HEADER_BG },
      ),
    )

    const widths = [ROOM_COL, ...month.days.map(() => dayWidth), NIGHTS_COL]
    content.push({
      table: {
        headerRows: 2,
        dontBreakRows: true,
        widths: isRTL ? [...widths].reverse() : widths,
        body,
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => LINE_WIDTH,
        hLineColor: () => BORDER,
        vLineColor: () => BORDER,
        paddingLeft: () => CELL_PAD_X,
        paddingRight: () => CELL_PAD_X,
        paddingTop: () => 1.5,
        paddingBottom: () => 1.5,
      },
      ...(monthIndex < 11 ? { pageBreak: 'after' as const } : {}),
    })
  }

  return content
}

export async function downloadYearViewPdf(payload: YearOverviewPayload, locale: string, labels: YearViewPdfLabels): Promise<void> {
  // Arabic guest/company names can appear even in LTR reports, so always load the font.
  const pdfMake = await getPdfMake(true)
  const content = buildYearViewPdfContent(payload, locale, labels)
  const docDef = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN, PAGE_MARGIN],
    defaultStyle: {
      font: 'Arial',
      fontSize: FONT_SIZE,
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
