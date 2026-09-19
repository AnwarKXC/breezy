import { describe, expect, it } from 'vitest'
import { buildPeriodRange } from './bookingService'

describe('buildPeriodRange', () => {
  it('returns null without a year', () => {
    expect(buildPeriodRange()).toBeNull()
  })

  it('builds a full-year range', () => {
    expect(buildPeriodRange(2025)).toEqual({ start: '2025-01-01', end: '2026-01-01' })
  })

  it('builds a month range', () => {
    expect(buildPeriodRange(2025, 6)).toEqual({ start: '2025-06-01', end: '2025-07-01' })
  })

  it('rolls December into the next year', () => {
    expect(buildPeriodRange(2025, 12)).toEqual({ start: '2025-12-01', end: '2026-01-01' })
  })
})