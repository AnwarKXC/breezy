import { describe, expect, it } from 'vitest'
import { buildDayMap, getMonthWeeks, indexByRoomAndDate, strongestStatus } from './dayMap'
import type { DayBooking } from './dayMap'
import type { YearOverviewStay } from '../types'

const stay = (over: Partial<YearOverviewStay> = {}): YearOverviewStay => ({
  roomId: 'r1',
  reservationId: 'res1',
  code: 'RSV-100',
  status: 'confirmed',
  from: '2026-03-02',
  to: '2026-03-05',
  guestName: 'John Doe',
  source: 'booking',
  companyName: null as string | null,
  ...over,
})

const bk = (status: string): DayBooking => ({
  roomId: 'r1',
  reservationId: 'res1',
  status,
  code: 'C',
  guestName: null,
  from: '2026-03-01',
  to: '2026-03-02',
  source: 'booking',
  companyName: null,
})

describe('buildDayMap', () => {
  it('lists every overlapping booking per date (no first-wins)', () => {
    const map = buildDayMap([stay(), stay({ roomId: 'r2', status: 'checked_in' })], 2026)
    expect(map.get('2026-03-02')).toHaveLength(2)
    expect(map.get('2026-03-04')).toHaveLength(2)
    expect(map.get('2026-03-02')![0]).toMatchObject({ source: 'booking' })
    expect(map.get('2026-03-02')![0]).toMatchObject({ reservationId: 'res1', companyName: null })
    expect(map.has('2026-03-05')).toBe(false)
  })

  it('carries company name through to day bookings', () => {
    const map = buildDayMap([stay({ companyName: 'Acme Corp' })], 2026)
    expect(map.get('2026-03-02')![0].companyName).toBe('Acme Corp')
  })

  it('clamps to the year but keeps original stay bounds on entries', () => {
    const map = buildDayMap([stay({ from: '2025-12-30', to: '2026-01-02' })], 2026)
    expect(map.size).toBe(1)
    expect(map.get('2026-01-01')![0]).toMatchObject({ from: '2025-12-30', to: '2026-01-02' })
  })

  it('skips stays entirely outside the target year', () => {
    expect(buildDayMap([stay({ from: '2025-11-01', to: '2025-11-05' })], 2026).size).toBe(0)
  })
})

describe('strongestStatus', () => {
  it('applies checked_in > confirmed > checked_out > other precedence, null when empty', () => {
    expect(strongestStatus([])).toBeNull()
    expect(strongestStatus([bk('confirmed'), bk('checked_out')])).toBe('confirmed')
    expect(strongestStatus([bk('checked_out'), bk('checked_in')])).toBe('checked_in')
    expect(strongestStatus([bk('checked_out')])).toBe('checked_out')
    expect(strongestStatus([bk('held')])).toBe('other')
    expect(strongestStatus([bk('cancelled'), bk('confirmed')])).toBe('confirmed')
  })
})

describe('getMonthWeeks', () => {
  it('pads March 2026 (starts Sunday) with 6 leading nulls in Monday-start weeks of 7', () => {
    const weeks = getMonthWeeks(2026, 2)
    expect(weeks[0][0]).toEqual({ iso: null, dayNumber: null })
    expect(weeks[0][5]).toEqual({ iso: null, dayNumber: null })
    expect(weeks[0][6]).toEqual({ iso: '2026-03-01', dayNumber: 1 })
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    const days = weeks.flat().filter((c) => c.iso !== null)
    expect(days).toHaveLength(31)
    expect(days[days.length - 1]).toEqual({ iso: '2026-03-31', dayNumber: 31 })
  })

  it('produces exactly 4 weeks for Feb 2027 (starts Monday, 28 days)', () => {
    const weeks = getMonthWeeks(2027, 1)
    expect(weeks).toHaveLength(4)
    expect(weeks[0][0]).toEqual({ iso: '2027-02-01', dayNumber: 1 })
  })
})

describe('indexByRoomAndDate', () => {
  it('keys bookings by roomId|iso for O(1) sheet lookups', () => {
    const map = buildDayMap([stay(), stay({ roomId: 'r2', status: 'checked_in' })], 2026)
    const index = indexByRoomAndDate(map)
    expect(index.get('r1|2026-03-02')?.code).toBe('RSV-100')
    expect(index.get('r2|2026-03-03')?.status).toBe('checked_in')
    expect(index.has('r1|2026-03-05')).toBe(false)
  })
})
