import { describe, expect, it } from 'vitest'
import { buildYearCsv } from './csvExport'
import type { YearOverviewPayload } from '../types'

const payload: YearOverviewPayload = {
  year: 2028,
  roomTypes: [{ id: 't1', name: 'Std' }],
  rooms: [{ id: 'r1', number: '101', typeId: 't1' }],
  stays: [
    {
      roomId: 'r1',
      reservationId: 'res1',
      code: 'RSV-100',
      status: 'checked_in',
      from: '2028-03-02',
      to: '2028-03-04',
      guestName: null,
      source: 'booking',
      companyName: null,
    },
  ],
}

describe('buildYearCsv', () => {
  it('writes a header with room columns and one row per day (leap year = 366)', () => {
    const lines = buildYearCsv(payload, 'en').split('\r\n')
    expect(lines[0]).toBe('"Month","Day","Weekday","Std – 101"')
    expect(lines).toHaveLength(367)
  })

  it('marks occupied days and leaves others empty', () => {
    const lines = buildYearCsv(payload, 'en').split('\r\n')
    // Jan(31) + Feb(29) = 60 day rows before March; header is line 0
    const mar2 = lines[62]
    const mar4 = lines[64]
    expect(mar2).toBe('"March","2","Thu","IN-HOUSE"')
    expect(mar4).toBe('"March","4","Sat",""')
  })

  it('labels non-display statuses as BOOKED', () => {
    const held: YearOverviewPayload = {
      ...payload,
      stays: [{ ...payload.stays[0], status: 'held' }],
    }
    const lines = buildYearCsv(held, 'en').split('\r\n')
    expect(lines[62]).toBe('"March","2","Thu","BOOKED"')
  })
})
