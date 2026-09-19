import { describe, expect, it } from 'vitest'
import { buildYearViewPdfContent } from './yearViewPdfExport'
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

type Cell = Record<string, unknown>

function tables(content: unknown[]): Array<{ table: { body: Cell[][]; widths: unknown[] }; pageBreak?: string }> {
  return content as never
}

describe('buildYearViewPdfContent', () => {
  it('builds 12 month tables, one per page', () => {
    const content = tables(buildYearViewPdfContent(payload, 'en'))
    expect(content).toHaveLength(12)
    expect(content[0].pageBreak).toBe('after')
    expect(content[11].pageBreak).toBeUndefined()
  })

  it('renders a green centered merged month title row', () => {
    const content = tables(buildYearViewPdfContent(payload, 'en'))
    const title = content[2].table.body[0][0]
    expect(title.text).toBe('March 2026')
    expect(title.colSpan).toBe(3)
    expect(title.fillColor).toBe('#16A34A')
    expect(title.alignment).toBe('center')
  })

  it('renders group headers with colSpans and room number row', () => {
    const content = tables(buildYearViewPdfContent(payload, 'en'))
    const groupRow = content[2].table.body[1]
    expect(groupRow[1].text).toBe('Double')
    expect(groupRow[1].colSpan).toBe(1)
    const roomRow = content[2].table.body[2]
    expect(roomRow.map((c) => c.text)).toEqual(['#', '101', '201'])
  })

  it('fills occupied cells with display name and type, weekend rows shaded', () => {
    const content = tables(buildYearViewPdfContent(payload, 'en'))
    // 2026-03-06 is a Friday, occupied by Acme Corp (stay ends exclusive)
    const friday = content[2].table.body.find((r) => r[0].text === '6-3-2026')!
    expect(friday[0].fillColor).toBe('#FEF3C7')
    expect(friday[2].text).toBe('Acme Corp\nSuite')
    // 2026-03-02: John Doe occupied, r2 vacant
    const monday = content[2].table.body.find((r) => r[0].text === '2-3-2026')!
    expect(monday[1].text).toBe('John Doe\nDouble')
    expect(monday[2].text).toBe('')
    expect(monday[1].fillColor).toBeUndefined()
  })
})
