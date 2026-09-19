import { describe, expect, it } from 'vitest'
import { buildOccupancy, getMonthDays, monthLabel, monthStats } from './occupancy'
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
  companyName: null,
  ...over,
})

describe('buildOccupancy', () => {
  it('expands a stay into per-day cells with an exclusive end', () => {
    const map = buildOccupancy([stay()], 2026)
    const room = map.get('r1')!
    expect(room.size).toBe(3)
    expect(room.has('2026-03-02')).toBe(true)
    expect(room.has('2026-03-04')).toBe(true)
    expect(room.has('2026-03-05')).toBe(false)
    expect(room.get('2026-03-02')).toEqual({ status: 'confirmed', code: 'RSV-100', guestName: 'John Doe', from: '2026-03-02', to: '2026-03-05' })
  })

  it('clamps stays crossing the year boundary', () => {
    const map = buildOccupancy([stay({ from: '2025-12-28', to: '2026-01-03' })], 2026)
    const room = map.get('r1')!
    expect(room.size).toBe(2)
    expect(room.has('2026-01-01')).toBe(true)
    expect(room.has('2026-01-02')).toBe(true)
  })

  it('emits entries for multi-room reservations and keeps first stay on overlap', () => {
    const map = buildOccupancy(
      [stay(), stay({ roomId: 'r2' }), stay({ from: '2026-03-04', to: '2026-03-06', code: 'RSV-200' })],
      2026,
    )
    expect(map.get('r2')!.size).toBe(3)
    expect(map.get('r1')!.get('2026-03-04')!.code).toBe('RSV-100')
    expect(map.get('r1')!.get('2026-03-05')!.code).toBe('RSV-200')
  })

  it('buckets unknown or non-display statuses as other', () => {
    const map = buildOccupancy([stay({ status: 'held' }), stay({ roomId: 'r2', status: 'cancelled' })], 2026)
    expect(map.get('r1')!.get('2026-03-02')!.status).toBe('other')
    expect(map.get('r2')!.get('2026-03-02')!.status).toBe('other')
  })
})

describe('getMonthDays', () => {
  it('returns correct day counts including leap years', () => {
    expect(getMonthDays(2026, 1, '', 'en')).toHaveLength(28)
    expect(getMonthDays(2028, 1, '', 'en')).toHaveLength(29)
  })

  it('marks Fridays and Saturdays as weekend', () => {
    const days = getMonthDays(2026, 0, '', 'en')
    // 2026-01-01 is a Thursday, 01-02 Friday, 01-03 Saturday
    expect(days.find((d) => d.iso === '2026-01-01')!.isWeekend).toBe(false)
    expect(days.find((d) => d.iso === '2026-01-02')!.isWeekend).toBe(true)
    expect(days.find((d) => d.iso === '2026-01-03')!.isWeekend).toBe(true)
  })

  it('flags today by ISO match', () => {
    const days = getMonthDays(2026, 2, '2026-03-10', 'en')
    expect(days.find((d) => d.dayNumber === 10)!.isToday).toBe(true)
    expect(days.find((d) => d.dayNumber === 9)!.isToday).toBe(false)
  })
})

describe('monthLabel / monthStats', () => {
  it('formats the month label in the given locale', () => {
    expect(monthLabel(2026, 2, 'en')).toContain('March')
    expect(monthLabel(2026, 2, 'ar')).not.toContain('March')
  })

  it('clamps room-nights at month boundaries', () => {
    const stats = monthStats(
      [stay({ from: '2026-02-25', to: '2026-03-05' }), stay({ from: '2026-03-20', to: '2026-04-02', roomId: 'r2' })],
      2026,
      2,
    )
    expect(stats.stays).toBe(2)
    expect(stats.roomNights).toBe(4 + 12)
  })
})
