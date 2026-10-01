import 'server-only'

import { z } from 'zod'

import type { Prisma } from '@/generated/prisma/client'
import type { KpiItem, ResultBlock, TableColumn } from '@/modules/assistant/types'
import { prisma } from '@/services/db/prisma'
import { dbDate } from '@/services/db/rows'

import { normalizeDigits } from '../arabic'
import { addDays, hotelDayStart, periodArgs } from '../periods'
import { findCompanies, findGuests } from './guests'
import { defineTool, ToolInputError } from './registry'
import {
  dateRange,
  guestFullName,
  limitForModel,
  LIVE_RESERVATION_STATUSES,
  MoneyBag,
  NOT_BOOKED_STATUSES,
  num,
  pct,
  period,
  round,
  ymd,
} from './shared'

const RESERVATION_STATUSES = ['draft', 'held', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show', 'expired'] as const
const RESERVATION_SOURCES = ['walk_in', 'phone', 'website', 'whatsapp', 'email', 'company', 'travel_agent', 'ota', 'manual'] as const
const BOOKING_TYPES = ['individual', 'company', 'group', 'travel_agent', 'internal'] as const

const listSelect = {
  id: true,
  reservation_number: true,
  check_in_date: true,
  check_out_date: true,
  nights: true,
  adults: true,
  children: true,
  room_count: true,
  status: true,
  source: true,
  currency: true,
  total_amount: true,
  paid_amount: true,
  balance_amount: true,
  booker_name: true,
  guests: { select: { first_name: true, last_name: true, phone: true } },
  contacts: { select: { name: true } },
  reservation_rooms: { where: { deleted_at: null }, select: { rooms: { select: { number: true } } } },
} satisfies Prisma.reservationsSelect

type ListRow = Prisma.reservationsGetPayload<{ select: typeof listSelect }>

function toListRow(r: ListRow) {
  return {
    reservation_number: r.reservation_number,
    guest: guestFullName(r.guests) ?? r.booker_name,
    phone: r.guests?.phone ?? null,
    company: r.contacts?.name ?? null,
    check_in: ymd(r.check_in_date),
    check_out: ymd(r.check_out_date),
    nights: r.nights,
    guests_count: r.adults + r.children,
    rooms: [...new Set(r.reservation_rooms.map((rr) => rr.rooms.number))].join(', '),
    status: r.status,
    source: r.source,
    currency: r.currency,
    total: round(num(r.total_amount)),
    paid: round(num(r.paid_amount)),
    balance: round(num(r.balance_amount)),
  }
}

const LIST_COLUMNS: TableColumn[] = [
  { key: 'reservation_number', format: 'text' },
  { key: 'guest', format: 'text' },
  { key: 'company', format: 'text' },
  { key: 'check_in', format: 'date' },
  { key: 'check_out', format: 'date' },
  { key: 'nights', format: 'number' },
  { key: 'rooms', format: 'text' },
  { key: 'status', format: 'enum' },
  { key: 'total', format: 'money', currencyKey: 'currency' },
  { key: 'balance', format: 'money', currencyKey: 'currency' },
]

function dateWhere(field: 'check_in' | 'check_out' | 'created' | 'stay', range: { from: string; to: string }): Prisma.reservationsWhereInput {
  if (field === 'check_out') return { check_out_date: dateRange(range) }
  if (field === 'created') return { created_at: { gte: hotelDayStart(range.from), lt: hotelDayStart(addDays(range.to, 1)) } }
  if (field === 'stay') return { check_in_date: { lte: dbDate(range.to) }, check_out_date: { gt: dbDate(range.from) } }
  return { check_in_date: dateRange(range) }
}

export const searchReservations = defineTool({
  name: 'search_reservations',
  description:
    'List reservations (حجوزات) filtered by period, status, source, guest name/phone, company or unpaid balance. date_field picks which date the period applies to (default check_in; "stay" = staying at any time in the period).',
  args: z.object({
    ...periodArgs,
    period: periodArgs.period.optional(),
    date_field: z.enum(['check_in', 'check_out', 'created', 'stay']).optional(),
    status: z.array(z.enum(RESERVATION_STATUSES)).optional(),
    source: z.enum(RESERVATION_SOURCES).optional(),
    booking_type: z.enum(BOOKING_TYPES).optional(),
    guest: z.string().max(100).optional().describe('Guest name or phone fragment'),
    company: z.string().max(100).optional().describe('Company name fragment'),
    unpaid_only: z.boolean().optional().describe('Only reservations with a remaining balance'),
    limit: z.number().int().min(1).max(50).optional().describe('Default: 20'),
  }),
  async run(args, ctx) {
    const range = args.period ? period({ ...args, period: args.period }, ctx) : null
    const where: Prisma.reservationsWhereInput = { deleted_at: null }
    const and: Prisma.reservationsWhereInput[] = []
    if (range) and.push(dateWhere(args.date_field ?? 'check_in', range))
    if (args.status?.length) where.status = { in: args.status }
    if (args.source) where.source = args.source
    if (args.booking_type) where.booking_type = args.booking_type
    if (args.unpaid_only) where.balance_amount = { gt: 0 }
    if (args.guest) {
      const guests = await findGuests(args.guest, 200)
      and.push({
        OR: [
          { primary_guest_id: { in: guests.map((g) => g.id) } },
          { reservation_guests: { some: { guest_id: { in: guests.map((g) => g.id) }, deleted_at: null } } },
          { booker_name: { contains: args.guest.trim(), mode: 'insensitive' } },
        ],
      })
    }
    if (args.company) {
      const companies = await findCompanies(args.company, 100)
      if (!companies.length) return { data: { matches: 0, note: `No company matches "${args.company}".` }, blocks: [] }
      and.push({ company_id: { in: companies.map((c) => c.id) } })
    }
    if (and.length) where.AND = and

    const orderField = args.date_field === 'check_out' ? 'check_out_date' : args.date_field === 'created' ? 'created_at' : 'check_in_date'
    const [total, rows] = await Promise.all([
      prisma.reservations.count({ where }),
      prisma.reservations.findMany({ where, select: listSelect, orderBy: { [orderField]: range ? 'asc' : 'desc' }, take: args.limit ?? 20 }),
    ])
    const list = rows.map(toListRow)
    return {
      data: { period: range, total_matches: total, shown: list.length, reservations: limitForModel(list, 20) },
      blocks: [{ type: 'table', title: 'reservations', period: range ?? undefined, columns: LIST_COLUMNS, rows: list, totalRows: total }],
    }
  },
})

export const getArrivalsDepartures = defineTool({
  name: 'get_arrivals_departures',
  description:
    'Arrivals (الوصول / مين داخل), departures (المغادرة / مين خارج) for a period (default today), or guests in-house right now (المقيمين حالياً).',
  args: z.object({
    type: z.enum(['arrivals', 'departures', 'in_house']),
    ...periodArgs,
    period: periodArgs.period.optional().describe('Default: TODAY. Ignored for in_house.'),
  }),
  async run(args, ctx) {
    const range = args.type === 'in_house' ? null : period({ ...args, period: args.period ?? 'TODAY' }, ctx)
    const where: Prisma.reservationsWhereInput =
      args.type === 'arrivals'
        ? { deleted_at: null, status: { in: ['held', 'confirmed', 'checked_in'] }, check_in_date: dateRange(range!) }
        : args.type === 'departures'
          ? { deleted_at: null, status: { in: ['confirmed', 'checked_in', 'checked_out'] }, check_out_date: dateRange(range!) }
          : { deleted_at: null, status: 'checked_in' }
    const rows = await prisma.reservations.findMany({
      where,
      select: listSelect,
      orderBy: args.type === 'departures' ? { check_out_date: 'asc' } : { check_in_date: 'asc' },
      take: 200,
    })
    const list = rows.map(toListRow)
    const balance = new MoneyBag()
    for (const r of list) balance.add(r.currency, r.balance, r.currency)
    const items: KpiItem[] = [
      { key: args.type, value: list.length, format: 'number' },
      { key: 'guests_count', value: list.reduce((sum, r) => sum + r.guests_count, 0), format: 'number' },
      ...balance.toMoney().map((m): KpiItem => ({ key: 'balance', value: m.amount, format: 'money', currency: m.currency })),
    ]
    return {
      data: { type: args.type, period: range, count: list.length, open_balance: balance.toMoney(), reservations: limitForModel(list, 25) },
      blocks: [
        { type: 'kpi', title: args.type, period: range ?? undefined, items },
        {
          type: 'table',
          title: args.type,
          period: range ?? undefined,
          columns: [...LIST_COLUMNS.slice(0, 7), { key: 'phone', format: 'text' }, ...LIST_COLUMNS.slice(7)],
          rows: list,
          totalRows: list.length,
        },
      ],
    }
  },
})

export const getReservationSummary = defineTool({
  name: 'get_reservation_summary',
  description:
    'Reservation counts and booked value by status for a period (confirmed, checked in/out, cancelled, no-show …) with cancellation rate and average length of stay.',
  args: z.object({
    ...periodArgs,
    date_field: z.enum(['check_in', 'created']).optional().describe('check_in = arriving in the period (default); created = booked in the period'),
  }),
  async run(args, ctx) {
    const range = period(args, ctx)
    const groups = await prisma.reservations.groupBy({
      by: ['status', 'currency'],
      where: { deleted_at: null, status: { notIn: NOT_BOOKED_STATUSES }, ...dateWhere(args.date_field ?? 'check_in', range) },
      _count: { _all: true },
      _sum: { nights: true, total_amount: true },
    })
    const byStatus = new Map<string, { status: string; reservations: number; nights: number; value: MoneyBag }>()
    for (const g of groups) {
      let row = byStatus.get(g.status)
      if (!row) byStatus.set(g.status, (row = { status: g.status, reservations: 0, nights: 0, value: new MoneyBag() }))
      row.reservations += g._count._all
      row.nights += g._sum.nights ?? 0
      row.value.add(g.currency, num(g._sum.total_amount), ctx.systemCurrency)
    }
    const rows = [...byStatus.values()]
      .sort((a, b) => RESERVATION_STATUSES.indexOf(a.status as never) - RESERVATION_STATUSES.indexOf(b.status as never))
      .map((r) => ({ status: r.status, reservations: r.reservations, nights: r.nights, value: r.value.toMoney() }))

    const total = rows.reduce((s, r) => s + r.reservations, 0)
    const live = rows.filter((r) => LIVE_RESERVATION_STATUSES.includes(r.status as never))
    const liveCount = live.reduce((s, r) => s + r.reservations, 0)
    const liveNights = live.reduce((s, r) => s + r.nights, 0)
    const cancelled = rows.find((r) => r.status === 'cancelled')?.reservations ?? 0
    const noShow = rows.find((r) => r.status === 'no_show')?.reservations ?? 0
    const liveValue = new MoneyBag()
    for (const g of groups) if (LIVE_RESERVATION_STATUSES.includes(g.status)) liveValue.add(g.currency, num(g._sum.total_amount), ctx.systemCurrency)

    const summary = {
      reservations: total,
      confirmed_stays: liveCount,
      cancelled,
      no_show: noShow,
      cancellation_rate_pct: pct(cancelled, total),
      avg_nights: liveCount ? round(liveNights / liveCount, 1) : null,
      booked_value: liveValue.toMoney(),
    }
    return {
      data: { period: range, date_field: args.date_field ?? 'check_in', summary, by_status: rows },
      blocks: [
        {
          type: 'kpi',
          title: 'reservation_summary',
          period: range,
          items: [
            { key: 'reservations', value: total, format: 'number' },
            { key: 'confirmed_stays', value: liveCount, format: 'number' },
            { key: 'cancelled', value: cancelled, format: 'number' },
            { key: 'no_show', value: noShow, format: 'number' },
            { key: 'cancellation_rate_pct', value: summary.cancellation_rate_pct, format: 'percent' },
            { key: 'avg_nights', value: summary.avg_nights, format: 'number' },
            ...summary.booked_value.map((m): KpiItem => ({ key: 'booked_value', value: m.amount, format: 'money', currency: m.currency })),
          ],
        },
        {
          type: 'table',
          title: 'reservations_by_status',
          period: range,
          columns: [
            { key: 'status', format: 'enum' },
            { key: 'reservations', format: 'number' },
            { key: 'nights', format: 'number' },
            { key: 'value', format: 'money_list' },
          ],
          rows,
          totalRows: rows.length,
        },
      ],
    }
  },
})

export const getReservationsBySource = defineTool({
  name: 'get_reservations_by_source',
  description:
    'Where bookings come from: reservations, cancellations, nights and booked value per source (walk-in, phone, website, WhatsApp, OTA, company …) or per booking type. Whole-period totals only: for a per-month/per-week split use the SQL tools.',
  args: z.object({
    ...periodArgs,
    dimension: z.enum(['source', 'booking_type']).optional().describe('Default: source'),
    date_field: z.enum(['check_in', 'created']).optional(),
  }),
  async run(args, ctx) {
    const range = period(args, ctx)
    const dimension = args.dimension ?? 'source'
    const rows = await prisma.reservations.findMany({
      where: { deleted_at: null, status: { notIn: NOT_BOOKED_STATUSES }, ...dateWhere(args.date_field ?? 'check_in', range) },
      select: { source: true, booking_type: true, status: true, nights: true, currency: true, total_amount: true },
    })
    const groups = new Map<string, { group: string; reservations: number; cancelled: number; nights: number; value: MoneyBag }>()
    for (const r of rows) {
      const key = dimension === 'source' ? r.source : r.booking_type
      let row = groups.get(key)
      if (!row) groups.set(key, (row = { group: key, reservations: 0, cancelled: 0, nights: 0, value: new MoneyBag() }))
      row.reservations++
      if (r.status === 'cancelled' || r.status === 'no_show') {
        row.cancelled++
      } else {
        row.nights += r.nights
        row.value.add(r.currency, num(r.total_amount), ctx.systemCurrency)
      }
    }
    const list = [...groups.values()]
      .sort((a, b) => b.reservations - a.reservations)
      .map((r) => ({ group: r.group, reservations: r.reservations, cancelled: r.cancelled, share_pct: pct(r.reservations, rows.length), nights: r.nights, value: r.value.toMoney() }))
    const blocks: ResultBlock[] = [
      { type: 'bars', title: `reservations_by_${dimension}`, period: range, labelKey: 'group', labelFormat: 'enum', valueKey: 'reservations', format: 'number', rows: list },
      {
        type: 'table',
        title: `reservations_by_${dimension}`,
        period: range,
        columns: [
          { key: 'group', format: 'enum' },
          { key: 'reservations', format: 'number' },
          { key: 'share_pct', format: 'percent' },
          { key: 'cancelled', format: 'number' },
          { key: 'nights', format: 'number' },
          { key: 'value', format: 'money_list' },
        ],
        rows: list,
        totalRows: list.length,
      },
    ]
    return { data: { period: range, dimension, total: rows.length, rows: list }, blocks }
  },
})

export const getReservationDetails = defineTool({
  name: 'get_reservation_details',
  description: 'Everything about one reservation by its number: guests, rooms, rates, status, invoices and payments.',
  args: z.object({ reservation_number: z.string().min(1).max(40) }),
  async run(args) {
    const number = normalizeDigits(args.reservation_number).trim()
    const reservation = await prisma.reservations.findFirst({
      where: { deleted_at: null, reservation_number: { equals: number, mode: 'insensitive' } },
      select: {
        ...listSelect,
        booking_type: true,
        billing_party: true,
        created_at: true,
        reservation_rooms: {
          where: { deleted_at: null },
          select: {
            check_in_date: true,
            check_out_date: true,
            nights: true,
            rate_per_night: true,
            total_amount: true,
            status: true,
            adults: true,
            children: true,
            rooms: { select: { number: true } },
            room_types: { select: { name: true } },
          },
        },
        reservation_guests: { where: { deleted_at: null }, select: { full_name: true, role: true, phone: true, nationality: true, is_vip: true } },
        invoices: {
          where: { deleted_at: null },
          select: {
            invoice_number: true,
            status: true,
            currency: true,
            amount: true,
            paid_amount: true,
            remaining_balance: true,
            issue_date: true,
            payments: { where: { deleted_at: null }, select: { transaction_date: true, method: true, amount: true, currency: true } },
          },
        },
      },
    })
    if (!reservation) throw new ToolInputError(`No reservation with number "${number}". Ask the user to check the number or search by guest name.`)

    const summary = toListRow(reservation)
    const rooms = reservation.reservation_rooms.map((rr) => ({
      room: rr.rooms.number,
      room_type: rr.room_types.name,
      check_in: ymd(rr.check_in_date),
      check_out: ymd(rr.check_out_date),
      nights: rr.nights,
      guests_count: rr.adults + rr.children,
      currency: reservation.currency,
      rate_per_night: round(num(rr.rate_per_night)),
      total: round(num(rr.total_amount)),
      status: rr.status,
    }))
    const guests = reservation.reservation_guests.map((g) => ({ guest: g.full_name, role: g.role, phone: g.phone, nationality: g.nationality, vip: g.is_vip ? '★' : '' }))
    const invoices = reservation.invoices.map((inv) => ({
      invoice_number: inv.invoice_number,
      issue_date: ymd(inv.issue_date),
      status: inv.status,
      currency: inv.currency,
      amount: round(num(inv.amount)),
      paid: round(num(inv.paid_amount)),
      remaining: round(num(inv.remaining_balance)),
    }))
    const payments = reservation.invoices.flatMap((inv) =>
      inv.payments.map((p) => ({ date: ymd(p.transaction_date), invoice_number: inv.invoice_number, method: p.method, currency: p.currency, amount: round(num(p.amount)) })),
    )

    const blocks: ResultBlock[] = [
      {
        type: 'kpi',
        title: 'reservation_details',
        items: [
          { key: 'nights', value: summary.nights, format: 'number' },
          { key: 'guests_count', value: summary.guests_count, format: 'number' },
          { key: 'total', value: summary.total, format: 'money', currency: summary.currency },
          { key: 'paid', value: summary.paid, format: 'money', currency: summary.currency },
          { key: 'balance', value: summary.balance, format: 'money', currency: summary.currency },
        ],
      },
      {
        type: 'table',
        title: 'reservation_rooms',
        columns: [
          { key: 'room', format: 'text' },
          { key: 'room_type', format: 'text' },
          { key: 'check_in', format: 'date' },
          { key: 'check_out', format: 'date' },
          { key: 'nights', format: 'number' },
          { key: 'rate_per_night', format: 'money', currencyKey: 'currency' },
          { key: 'total', format: 'money', currencyKey: 'currency' },
          { key: 'status', format: 'enum' },
        ],
        rows: rooms,
        totalRows: rooms.length,
      },
    ]
    if (guests.length) {
      blocks.push({
        type: 'table',
        title: 'reservation_guests',
        columns: [
          { key: 'guest', format: 'text' },
          { key: 'role', format: 'enum' },
          { key: 'phone', format: 'text' },
          { key: 'nationality', format: 'text' },
          { key: 'vip', format: 'text' },
        ],
        rows: guests,
        totalRows: guests.length,
      })
    }
    if (invoices.length) {
      blocks.push({
        type: 'table',
        title: 'reservation_invoices',
        columns: [
          { key: 'invoice_number', format: 'text' },
          { key: 'issue_date', format: 'date' },
          { key: 'status', format: 'enum' },
          { key: 'amount', format: 'money', currencyKey: 'currency' },
          { key: 'paid', format: 'money', currencyKey: 'currency' },
          { key: 'remaining', format: 'money', currencyKey: 'currency' },
        ],
        rows: invoices,
        totalRows: invoices.length,
      })
    }
    if (payments.length) {
      blocks.push({
        type: 'table',
        title: 'reservation_payments',
        columns: [
          { key: 'date', format: 'date' },
          { key: 'invoice_number', format: 'text' },
          { key: 'method', format: 'enum' },
          { key: 'amount', format: 'money', currencyKey: 'currency' },
        ],
        rows: payments,
        totalRows: payments.length,
      })
    }
    return {
      data: {
        reservation: { ...summary, booking_type: reservation.booking_type, billing_party: reservation.billing_party, created_at: reservation.created_at.toISOString() },
        rooms,
        guests,
        invoices,
        payments,
      },
      blocks,
    }
  },
})
