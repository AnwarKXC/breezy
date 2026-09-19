import { describe, expect, it } from 'vitest'
import { getExpensePeriodFilter, defaultPeriodValue, currentYearValue } from './expensePeriod'

describe('getExpensePeriodFilter', () => {
  it('maps a monthly period to the native month param', () => {
    expect(getExpensePeriodFilter('month', '2026-08')).toEqual({ month: '2026-08' })
  })

  it('maps a yearly period to inclusive year bounds', () => {
    expect(getExpensePeriodFilter('year', '2026')).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    })
  })

  it('returns an empty filter when no period is selected', () => {
    expect(getExpensePeriodFilter(null, '')).toEqual({})
  })

  it('ignores malformed month values', () => {
    expect(getExpensePeriodFilter('month', '2026-13')).toEqual({})
    expect(getExpensePeriodFilter('month', 'august')).toEqual({})
  })

  it('ignores malformed year values', () => {
    expect(getExpensePeriodFilter('year', '20')).toEqual({})
    expect(getExpensePeriodFilter('year', '2026-08')).toEqual({})
  })

  it('never mixes month and date params', () => {
    const monthFilter = getExpensePeriodFilter('month', '2026-08')
    expect(monthFilter).not.toHaveProperty('fromDate')
    expect(monthFilter).not.toHaveProperty('toDate')

    const yearFilter = getExpensePeriodFilter('year', '2026')
    expect(yearFilter).not.toHaveProperty('month')
  })
})

describe('defaultPeriodValue', () => {
  it('returns the current month for monthly', () => {
    const value = defaultPeriodValue('month')
    expect(value).toMatch(/^\d{4}-\d{2}$/)
  })

  it('returns the current year for yearly', () => {
    expect(defaultPeriodValue('year')).toBe(currentYearValue())
    expect(defaultPeriodValue('year')).toMatch(/^\d{4}$/)
  })
})