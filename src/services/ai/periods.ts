import { z } from 'zod'

import type { PeriodRange } from '@/modules/assistant/types'

import { AI_TIMEZONE } from './timezone'

// The model never computes calendar boundaries: it picks a period token and the
// server resolves it in hotel time (Africa/Cairo, weeks start on Saturday).

export const PERIOD_KINDS = [
  'TODAY',
  'YESTERDAY',
  'TOMORROW',
  'THIS_WEEK',
  'LAST_WEEK',
  'NEXT_WEEK',
  'THIS_MONTH',
  'LAST_MONTH',
  'NEXT_MONTH',
  'THIS_YEAR',
  'LAST_YEAR',
  'YEAR_TO_DATE',
  'LAST_N_DAYS',
  'NEXT_N_DAYS',
  'MONTH',
  'YEAR',
  'CUSTOM',
  'ALL_TIME',
] as const

export type PeriodKind = (typeof PERIOD_KINDS)[number]

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')

/** Period arguments shared by every tool that takes a date range. */
export const periodArgs = {
  period: z.enum(PERIOD_KINDS).describe('Period token (see rules)'),
  month: z.number().int().min(1).max(12).optional().describe('For MONTH'),
  year: z.number().int().min(2000).max(2100).optional().describe('For MONTH/YEAR'),
  n: z.number().int().min(1).max(366).optional().describe('For LAST_N_DAYS/NEXT_N_DAYS'),
  from: isoDate.optional().describe('YYYY-MM-DD, for CUSTOM'),
  to: isoDate.optional().describe('YYYY-MM-DD inclusive, for CUSTOM'),
}

export type PeriodInput = {
  period: PeriodKind
  month?: number
  year?: number
  n?: number
  from?: string
  to?: string
}

export interface ResolvedPeriod extends PeriodRange {
  kind: PeriodKind
  /** Inclusive day count. */
  days: number
}

export class PeriodError extends Error {}

const DAY_MS = 86_400_000
const ALL_TIME_FROM = '2000-01-01'
const ALL_TIME_TO = '2100-12-31'

function parse(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return format(new Date(parse(date).getTime() + days * DAY_MS))
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS)
}

function monthRange(year: number, month: number): PeriodRange {
  const from = format(new Date(Date.UTC(year, month - 1, 1)))
  const to = format(new Date(Date.UTC(year, month, 0)))
  return { from, to }
}

/** Today's date in hotel time. */
export function hotelToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AI_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Minutes the hotel clock is ahead of UTC at `at` (handles Egypt's DST). */
function hotelOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AI_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value)
  return (Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - at.getTime()) / 60_000
}

/** The instant hotel-local midnight starts `date`, for filtering timestamptz columns. */
export function hotelDayStart(date: string): Date {
  const utcMidnight = parse(date)
  return new Date(utcMidnight.getTime() - hotelOffsetMinutes(utcMidnight) * 60_000)
}

export function weekdayName(date: string): string {
  return parse(date).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
}

/** Saturday on or before `date`. */
export function weekStart(date: string): string {
  const dow = parse(date).getUTCDay() // 0 = Sunday … 6 = Saturday
  return addDays(date, -((dow + 1) % 7))
}

function build(kind: PeriodKind, range: PeriodRange): ResolvedPeriod {
  if (range.from > range.to) throw new PeriodError(`Period start ${range.from} is after its end ${range.to}`)
  return { kind, ...range, days: daysBetween(range.from, range.to) + 1 }
}

export function resolvePeriod(input: PeriodInput, today: string): ResolvedPeriod {
  const [year, month] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))]
  switch (input.period) {
    case 'TODAY':
      return build('TODAY', { from: today, to: today })
    case 'YESTERDAY':
      return build('YESTERDAY', { from: addDays(today, -1), to: addDays(today, -1) })
    case 'TOMORROW':
      return build('TOMORROW', { from: addDays(today, 1), to: addDays(today, 1) })
    case 'THIS_WEEK': {
      const start = weekStart(today)
      return build('THIS_WEEK', { from: start, to: addDays(start, 6) })
    }
    case 'LAST_WEEK': {
      const start = addDays(weekStart(today), -7)
      return build('LAST_WEEK', { from: start, to: addDays(start, 6) })
    }
    case 'NEXT_WEEK': {
      const start = addDays(weekStart(today), 7)
      return build('NEXT_WEEK', { from: start, to: addDays(start, 6) })
    }
    case 'THIS_MONTH':
      return build('THIS_MONTH', monthRange(year, month))
    case 'LAST_MONTH':
      return build('LAST_MONTH', month === 1 ? monthRange(year - 1, 12) : monthRange(year, month - 1))
    case 'NEXT_MONTH':
      return build('NEXT_MONTH', month === 12 ? monthRange(year + 1, 1) : monthRange(year, month + 1))
    case 'THIS_YEAR':
      return build('THIS_YEAR', { from: `${year}-01-01`, to: `${year}-12-31` })
    case 'LAST_YEAR':
      return build('LAST_YEAR', { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` })
    case 'YEAR_TO_DATE':
      return build('YEAR_TO_DATE', { from: `${year}-01-01`, to: today })
    case 'LAST_N_DAYS': {
      const n = input.n ?? 7
      return build('LAST_N_DAYS', { from: addDays(today, -(n - 1)), to: today })
    }
    case 'NEXT_N_DAYS': {
      const n = input.n ?? 7
      return build('NEXT_N_DAYS', { from: today, to: addDays(today, n - 1) })
    }
    case 'MONTH': {
      if (!input.month) throw new PeriodError('Period MONTH requires `month`')
      return build('MONTH', monthRange(input.year ?? year, input.month))
    }
    case 'YEAR': {
      const y = input.year ?? year
      return build('YEAR', { from: `${y}-01-01`, to: `${y}-12-31` })
    }
    case 'CUSTOM': {
      if (!input.from || !input.to) throw new PeriodError('Period CUSTOM requires `from` and `to`')
      return build('CUSTOM', { from: input.from, to: input.to })
    }
    case 'ALL_TIME':
      return build('ALL_TIME', { from: ALL_TIME_FROM, to: ALL_TIME_TO })
  }
}

/** The comparable period right before `period` (previous calendar month/year/week where that applies). */
export function previousPeriod(period: ResolvedPeriod): ResolvedPeriod {
  const isWholeMonth = period.from.endsWith('-01') && period.to === monthRange(Number(period.to.slice(0, 4)), Number(period.to.slice(5, 7))).to && period.from.slice(0, 7) === period.to.slice(0, 7)
  if (isWholeMonth) {
    const [y, m] = [Number(period.from.slice(0, 4)), Number(period.from.slice(5, 7))]
    return build('CUSTOM', m === 1 ? monthRange(y - 1, 12) : monthRange(y, m - 1))
  }
  const isWholeYear = period.from.endsWith('-01-01') && period.to.endsWith('-12-31') && period.from.slice(0, 4) === period.to.slice(0, 4)
  if (isWholeYear) {
    const y = Number(period.from.slice(0, 4)) - 1
    return build('CUSTOM', { from: `${y}-01-01`, to: `${y}-12-31` })
  }
  if (period.kind === 'YEAR_TO_DATE') {
    const y = Number(period.from.slice(0, 4)) - 1
    return build('CUSTOM', { from: `${y}-01-01`, to: `${y}${period.to.slice(4)}` })
  }
  const to = addDays(period.from, -1)
  return build('CUSTOM', { from: addDays(to, -(period.days - 1)), to })
}
