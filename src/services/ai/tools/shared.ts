import 'server-only'

import type { Prisma, reservation_status } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'
import { dbDate } from '@/services/db/rows'
import { toMoney, type Money } from '@/shared/currency/money'

import { addDays, daysBetween, PeriodError, resolvePeriod, type PeriodInput, type ResolvedPeriod } from '../periods'
import { ToolInputError, type ToolContext } from './registry'

// ---------------------------------------------------------------------------
// Business definitions (single source for every tool)
//
// Invoiced  = issued invoices (status not draft/void), by issue_date, `amount`.
// Collected = payments by transaction_date, net of refunds (refunds are stored
//             as negative payments).
// Live stay = reservation in confirmed / checked_in / checked_out.
// Sold room-night = a night of a live reservation_room (reserved/occupied/checked_out).
// Money is always kept per currency — never summed across currencies.
// ---------------------------------------------------------------------------

export const LIVE_RESERVATION_STATUSES: reservation_status[] = ['confirmed', 'checked_in', 'checked_out']
export const NOT_BOOKED_STATUSES: reservation_status[] = ['draft', 'expired']
export const INVOICED_EXCLUDED = ['draft', 'void'] as const
export const OPEN_INVOICE_STATUSES = ['issued', 'partially_paid', 'overdue'] as const

export function period(input: PeriodInput, ctx: ToolContext): ResolvedPeriod {
  try {
    return resolvePeriod(input, ctx.today)
  } catch (error) {
    if (error instanceof PeriodError) throw new ToolInputError(error.message)
    throw error
  }
}

export function bounded(range: ResolvedPeriod, maxDays = 1100): ResolvedPeriod {
  if (range.kind === 'ALL_TIME' || range.days > maxDays) {
    throw new ToolInputError(`This report needs a bounded period of at most ${maxDays} days. Use a month, a year or explicit dates.`)
  }
  return range
}

export function dateRange(range: { from: string; to: string }) {
  return { gte: dbDate(range.from), lte: dbDate(range.to) }
}

export function ymd(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}

export function num(value: Prisma.Decimal | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value)
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function pct(part: number, whole: number): number | null {
  return whole > 0 ? round((part / whole) * 100, 1) : null
}

export function change(current: number, previous: number): number | null {
  return previous !== 0 ? round(((current - previous) / Math.abs(previous)) * 100, 1) : null
}

/** Accumulates amounts per currency. */
export class MoneyBag {
  private readonly totals = new Map<string, number>()

  add(currency: string | null | undefined, amount: number, fallback: string) {
    const code = currency || fallback
    this.totals.set(code, (this.totals.get(code) ?? 0) + amount)
    return this
  }

  get(currency: string) {
    return round(this.totals.get(currency) ?? 0)
  }

  currencies() {
    return [...this.totals.keys()]
  }

  toMoney(): Money {
    return toMoney([...this.totals].map(([currency, amount]) => ({ currency, amount })))
  }
}

export function moneyText(money: Money): string {
  return money.length ? money.map((m) => `${m.amount} ${m.currency}`).join(' + ') : '0'
}

export function sortCurrencies(currencies: Iterable<string>, systemCurrency: string): string[] {
  return [...new Set(currencies)].sort((a, b) => (a === systemCurrency ? -1 : b === systemCurrency ? 1 : a.localeCompare(b)))
}

export function guestFullName(guest: { first_name: string; last_name: string } | null | undefined): string | null {
  if (!guest) return null
  return `${guest.first_name} ${guest.last_name}`.trim() || null
}

// ---------------------------------------------------------------------------
// Stays: reservation_rooms overlapping a period, prorated to the period.
// ---------------------------------------------------------------------------

export interface StaySlice {
  reservationRoomId: string
  reservationId: string
  roomId: string
  roomNumber: string
  roomTypeId: string
  roomTypeName: string
  currency: string
  /** Nights of this stay that fall inside the period. */
  nightsInPeriod: number
  /** Room revenue attributed to those nights (total_amount prorated by nights). */
  revenueInPeriod: number
  /** First night inside the period, per night (for daily/monthly grouping). */
  nightDates: string[]
}

export async function loadStaySlices(range: { from: string; to: string }, fallbackCurrency: string): Promise<StaySlice[]> {
  const periodEndExclusive = addDays(range.to, 1)
  const rows = await prisma.reservation_rooms.findMany({
    where: {
      deleted_at: null,
      status: { in: ['reserved', 'occupied', 'checked_out'] },
      check_in_date: { lt: dbDate(periodEndExclusive) },
      check_out_date: { gt: dbDate(range.from) },
      reservations: { deleted_at: null, status: { in: LIVE_RESERVATION_STATUSES } },
    },
    select: {
      id: true,
      reservation_id: true,
      room_id: true,
      room_type_id: true,
      check_in_date: true,
      check_out_date: true,
      nights: true,
      total_amount: true,
      rooms: { select: { number: true } },
      room_types: { select: { name: true } },
      reservations: { select: { currency: true } },
    },
  })

  return rows.map((row) => {
    const checkIn = ymd(row.check_in_date)!
    const checkOut = ymd(row.check_out_date)!
    const start = checkIn > range.from ? checkIn : range.from
    const endExclusive = checkOut < periodEndExclusive ? checkOut : periodEndExclusive
    const nightsInPeriod = Math.max(0, daysBetween(start, endExclusive))
    const totalNights = row.nights > 0 ? row.nights : Math.max(1, daysBetween(checkIn, checkOut))
    const nightDates = Array.from({ length: nightsInPeriod }, (_, i) => addDays(start, i))
    return {
      reservationRoomId: row.id,
      reservationId: row.reservation_id,
      roomId: row.room_id,
      roomNumber: row.rooms.number,
      roomTypeId: row.room_type_id,
      roomTypeName: row.room_types.name,
      currency: row.reservations.currency || fallbackCurrency,
      nightsInPeriod,
      revenueInPeriod: round((num(row.total_amount) * nightsInPeriod) / totalNights),
      nightDates,
    }
  })
}

/** Rooms that exist (not deleted). Occupancy capacity uses this count. */
export async function countSellableRooms(): Promise<number> {
  return prisma.rooms.count({ where: { deleted_at: null } })
}

/** Caps arrays sent to the model; the UI still receives every row through blocks. */
export function limitForModel<T>(rows: T[], max = 25): { rows: T[]; shown: number; total: number } {
  return { rows: rows.slice(0, max), shown: Math.min(rows.length, max), total: rows.length }
}
