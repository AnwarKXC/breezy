import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildYearExcelBuffer } from './excelExport'
import type { YearOverviewPayload } from '../types'

const payload: YearOverviewPayload = {
  year: 2026,
  roomTypes: [
    { id: 't1', name: 'Double' },
    { id: 't2', name: 'Suite' },
  ],
  rooms: [
    { id: 'r1', number: '101', typeId: 't1' },
    { id: 'r2', number: '201', typeId: 't2' },
  ],
  stays: [
    {
      roomId: 'r1',
      reservationId: 'a',
      code: 'RSV-A',
      status: 'confirmed',
      from: '2026-03-02',
      to: '2026-03-04',
      guestName: 'John Doe',
      source: 'booking',
      companyName: null,
    },
    {
      roomId: 'r2',
      reservationId: 'b',
      code: 'RSV-B',
      status: 'checked_in',
      from: '2026-03-05',
      to: '2026-03-08',
      guestName: null,
      source: 'go',
      companyName: 'Acme Corp',
    },
  ],
}

async function loadSheet() {
  const buffer = await buildYearExcelBuffer(payload, 'en')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as ArrayBuffer)
  return wb.getWorksheet('Year')!
}

function findTitleRow(ws: ExcelJS.Worksheet, title: string): number {
  for (let r = 1; r <= ws.rowCount; r++) {
    if (ws.getRow(r).getCell(1).value === title) return r
  }
  throw new Error(`title row not found: ${title}`)
}

describe('buildYearExcelBuffer', () => {
  it('renders 12 merged green centered month title rows', async () => {
    const ws = await loadSheet()
    const months = ['January 2026', 'March 2026', 'December 2026']
    for (const m of months) {
      const r = findTitleRow(ws, m)
      const cell = ws.getRow(r).getCell(1)
      expect((cell.fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FF16A34A')
      expect(cell.alignment?.horizontal).toBe('center')
      expect(cell.font?.bold).toBe(true)
    }
    const march = findTitleRow(ws, 'March 2026')
    expect(ws.model.merges).toContain(`A${march}:C${march}`)
  })

  it('renders group headers and room number columns', async () => {
    const ws = await loadSheet()
    const march = findTitleRow(ws, 'March 2026')
    expect(ws.getRow(march + 1).getCell(2).value).toBe('Double')
    expect(ws.getRow(march + 1).getCell(3).value).toBe('Suite')
    const numbers = [1, 2, 3].map((c) => ws.getRow(march + 2).getCell(c).value)
    expect(numbers).toEqual(['#', '101', '201'])
  })

  it('fills occupied cells with display name + type and leaves vacant cells empty', async () => {
    const ws = await loadSheet()
    const march = findTitleRow(ws, 'March 2026')
    const mon = ws.getRow(march + 2 + 2) // day 2
    expect(mon.getCell(1).value).toBe('2-3-2026')
    const john = mon.getCell(2).value as { richText: Array<{ text: string }> }
    expect(john.richText.map((t) => t.text).join('')).toContain('John Doe')
    expect(john.richText.map((t) => t.text).join('')).toContain('Double')
    expect(mon.getCell(3).value).toBeNull()

    const sat = ws.getRow(march + 2 + 7) // day 7, Acme in-house (weekend)
    const acme = sat.getCell(3).value as { richText: Array<{ text: string }> }
    expect(acme.richText.map((t) => t.text).join('')).toContain('Acme Corp')
  })

  it('shades weekend rows amber', async () => {
    const ws = await loadSheet()
    const march = findTitleRow(ws, 'March 2026')
    const fri = ws.getRow(march + 2 + 6) // day 6, Friday
    expect((fri.getCell(1).fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFFEF3C7')
    const mon = ws.getRow(march + 2 + 2)
    expect((mon.getCell(1).fill as ExcelJS.FillPattern).fgColor?.argb).not.toBe('FFFEF3C7')
  })

  it('keeps hostile strings as plain text', async () => {
    const evil: YearOverviewPayload = {
      ...payload,
      stays: [{ ...payload.stays[0], guestName: '<b>hack</b>&co' }],
    }
    const buffer = await buildYearExcelBuffer(evil, 'en')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as ArrayBuffer)
    const ws = wb.getWorksheet('Year')!
    const march = findTitleRow(ws, 'March 2026')
    const cell = ws.getRow(march + 5).getCell(2).value as { richText: Array<{ text: string }> }
    expect(cell.richText[0].text).toBe('<b>hack</b>&co')
  })
})
