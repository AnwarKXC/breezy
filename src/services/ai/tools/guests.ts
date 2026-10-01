import 'server-only'

import { z } from 'zod'

import type { KpiItem } from '@/modules/assistant/types'
import { prisma } from '@/services/db/prisma'

import { digitsOnly, matchesAllTokens } from '../arabic'
import { periodArgs } from '../periods'
import { defineTool, ToolInputError } from './registry'
import { dateRange, guestFullName, limitForModel, LIVE_RESERVATION_STATUSES, MoneyBag, num, OPEN_INVOICE_STATUSES, period, round, ymd } from './shared'

// Name matching happens in JS with Arabic folding (أ/إ/آ → ا, ة → ه, tashkeel …),
// which Postgres LIKE cannot do. Fine at hotel scale; move to a normalized,
// trigram-indexed column if the guest table grows past ~50k rows.
const SEARCH_SCAN_LIMIT = 20_000

export async function findGuests(query: string, limit = 20) {
  const trimmed = query.trim()
  if (!trimmed) throw new ToolInputError('query must not be empty')
  const queryDigits = digitsOnly(trimmed)
  const guests = await prisma.guests.findMany({
    where: { deleted_at: null },
    select: { id: true, first_name: true, last_name: true, phone: true, email: true, country: true, status: true },
    take: SEARCH_SCAN_LIMIT,
  })
  return guests
    .filter((g) => {
      if (queryDigits.length >= 4 && g.phone && digitsOnly(g.phone).includes(queryDigits)) return true
      return matchesAllTokens(`${g.first_name} ${g.last_name} ${g.email}`, trimmed)
    })
    .slice(0, limit)
}

export async function findCompanies(query: string, limit = 20) {
  const trimmed = query.trim()
  if (!trimmed) throw new ToolInputError('query must not be empty')
  const companies = await prisma.contacts.findMany({
    where: { deleted_at: null, type: 'company' },
    select: { id: true, name: true, phone: true, email: true, city: true },
    take: SEARCH_SCAN_LIMIT,
  })
  return companies.filter((c) => matchesAllTokens(c.name, trimmed)).slice(0, limit)
}

export const searchGuests = defineTool({
  name: 'search_guests',
  description:
    'Find guests (ضيوف / نزلاء) by name (Arabic or English, partial), phone or email. Returns guest ids for get_guest_history plus stay counts.',
  args: z.object({
    query: z.string().min(1).max(100).describe('Name, phone or email fragment'),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  async run(args) {
    const guests = await findGuests(args.query, args.limit ?? 20)
    const stats = guests.length
      ? await prisma.reservations.groupBy({
          by: ['primary_guest_id'],
          where: { deleted_at: null, primary_guest_id: { in: guests.map((g) => g.id) }, status: { in: LIVE_RESERVATION_STATUSES } },
          _count: { _all: true },
          _sum: { nights: true },
          _max: { check_in_date: true },
        })
      : []
    const rows = guests.map((g) => {
      const stat = stats.find((s) => s.primary_guest_id === g.id)
      return {
        guest_id: g.id,
        guest: guestFullName(g),
        phone: g.phone,
        email: g.email,
        country: g.country,
        guest_status: g.status,
        stays: stat?._count._all ?? 0,
        nights: stat?._sum.nights ?? 0,
        last_check_in: ymd(stat?._max.check_in_date),
      }
    })
    return {
      data: { query: args.query, matches: rows.length, rows },
      blocks: [
        {
          type: 'table',
          title: 'guest_search',
          columns: [
            { key: 'guest', format: 'text' },
            { key: 'phone', format: 'text' },
            { key: 'email', format: 'text' },
            { key: 'country', format: 'text' },
            { key: 'guest_status', format: 'enum' },
            { key: 'stays', format: 'number' },
            { key: 'nights', format: 'number' },
            { key: 'last_check_in', format: 'date' },
          ],
          rows,
          totalRows: rows.length,
        },
      ],
    }
  },
})

export const getGuestHistory = defineTool({
  name: 'get_guest_history',
  description:
    'Full stay history of one guest: every reservation with dates, status and amounts, plus totals per currency. Pass guest_id from search_guests, or a name/phone in query (returns candidates if several guests match).',
  args: z.object({
    guest_id: z.uuid().optional(),
    query: z.string().min(1).max(100).optional().describe('Name or phone when guest_id is unknown'),
  }),
  async run(args) {
    let guestId = args.guest_id
    if (!guestId) {
      if (!args.query) throw new ToolInputError('Provide guest_id or query')
      const matches = await findGuests(args.query, 10)
      if (matches.length === 0) return { data: { found: false, query: args.query }, blocks: [] }
      if (matches.length > 1) {
        const rows = matches.map((g) => ({ guest_id: g.id, guest: guestFullName(g), phone: g.phone, email: g.email }))
        return {
          data: { found: false, ambiguous: true, note: 'Several guests match. Ask the user which one (show name + phone), then call again with guest_id.', candidates: rows },
          blocks: [
            {
              type: 'table',
              title: 'guest_candidates',
              columns: [
                { key: 'guest', format: 'text' },
                { key: 'phone', format: 'text' },
                { key: 'email', format: 'text' },
              ],
              rows,
              totalRows: rows.length,
            },
          ],
        }
      }
      guestId = matches[0].id
    }

    const guest = await prisma.guests.findFirst({
      where: { id: guestId, deleted_at: null },
      select: { id: true, first_name: true, last_name: true, phone: true, email: true, country: true, status: true },
    })
    if (!guest) return { data: { found: false, guest_id: guestId }, blocks: [] }

    const reservations = await prisma.reservations.findMany({
      where: {
        deleted_at: null,
        OR: [{ primary_guest_id: guest.id }, { reservation_guests: { some: { guest_id: guest.id, deleted_at: null } } }],
      },
      select: {
        reservation_number: true,
        check_in_date: true,
        check_out_date: true,
        nights: true,
        status: true,
        currency: true,
        total_amount: true,
        paid_amount: true,
        balance_amount: true,
        contacts: { select: { name: true } },
        reservation_rooms: { where: { deleted_at: null }, select: { rooms: { select: { number: true } } } },
      },
      orderBy: { check_in_date: 'desc' },
      take: 200,
    })

    const spent = new MoneyBag()
    const paid = new MoneyBag()
    const balance = new MoneyBag()
    let stays = 0
    let nights = 0
    let cancelled = 0
    for (const r of reservations) {
      if (LIVE_RESERVATION_STATUSES.includes(r.status)) {
        stays++
        nights += r.nights
        spent.add(r.currency, num(r.total_amount), r.currency)
        paid.add(r.currency, num(r.paid_amount), r.currency)
        balance.add(r.currency, num(r.balance_amount), r.currency)
      } else if (r.status === 'cancelled' || r.status === 'no_show') {
        cancelled++
      }
    }
    const rows = reservations.map((r) => ({
      reservation_number: r.reservation_number,
      check_in: ymd(r.check_in_date),
      check_out: ymd(r.check_out_date),
      nights: r.nights,
      rooms: [...new Set(r.reservation_rooms.map((rr) => rr.rooms.number))].join(', '),
      company: r.contacts?.name ?? null,
      status: r.status,
      currency: r.currency,
      total: round(num(r.total_amount)),
      paid: round(num(r.paid_amount)),
      balance: round(num(r.balance_amount)),
    }))
    const name = guestFullName(guest)
    const kpis: KpiItem[] = [
      { key: 'stays', value: stays, format: 'number' },
      { key: 'nights', value: nights, format: 'number' },
      { key: 'cancelled_or_no_show', value: cancelled, format: 'number' },
      ...spent.toMoney().map((m): KpiItem => ({ key: 'total_spent', value: m.amount, format: 'money', currency: m.currency })),
      ...balance.toMoney().map((m): KpiItem => ({ key: 'balance', value: m.amount, format: 'money', currency: m.currency })),
    ]
    return {
      data: {
        found: true,
        guest: { id: guest.id, name, phone: guest.phone, email: guest.email, country: guest.country, status: guest.status },
        stays,
        nights,
        cancelled_or_no_show: cancelled,
        total_spent: spent.toMoney(),
        total_paid: paid.toMoney(),
        open_balance: balance.toMoney(),
        first_check_in: rows.at(-1)?.check_in ?? null,
        last_check_in: rows[0]?.check_in ?? null,
        reservations: limitForModel(rows, 15),
      },
      blocks: [
        { type: 'kpi', title: 'guest_history', items: kpis },
        {
          type: 'table',
          title: 'guest_reservations',
          columns: [
            { key: 'reservation_number', format: 'text' },
            { key: 'check_in', format: 'date' },
            { key: 'check_out', format: 'date' },
            { key: 'nights', format: 'number' },
            { key: 'rooms', format: 'text' },
            { key: 'company', format: 'text' },
            { key: 'status', format: 'enum' },
            { key: 'total', format: 'money', currencyKey: 'currency' },
            { key: 'balance', format: 'money', currencyKey: 'currency' },
          ],
          rows,
          totalRows: rows.length,
        },
      ],
    }
  },
})

const rankArgs = {
  ...periodArgs,
  rank_by: z.enum(['revenue', 'nights', 'stays']).optional().describe('Default: revenue'),
  currency: z.string().length(3).optional().describe('Currency used to rank by revenue. Default: the system currency'),
  limit: z.number().int().min(1).max(50).optional().describe('Default: 10'),
}

interface RankRow {
  stays: number
  nights: number
  revenue: MoneyBag
}

function rank<T extends RankRow>(rows: T[], rankBy: 'revenue' | 'nights' | 'stays', currency: string) {
  return rows.sort((a, b) =>
    rankBy === 'nights'
      ? b.nights - a.nights || b.stays - a.stays
      : rankBy === 'stays'
        ? b.stays - a.stays || b.nights - a.nights
        : b.revenue.get(currency) - a.revenue.get(currency) || b.nights - a.nights,
  )
}

export const getTopGuests = defineTool({
  name: 'get_top_guests',
  description:
    'Top guests (أفضل / أكثر الضيوف) by revenue, nights or number of stays, for reservations arriving in a period. Revenue is ranked in one currency and shown per currency.',
  args: z.object(rankArgs),
  async run(args, ctx) {
    const range = period(args, ctx)
    const rankBy = args.rank_by ?? 'revenue'
    const currency = (args.currency ?? ctx.systemCurrency).toUpperCase()
    const reservations = await prisma.reservations.findMany({
      where: { deleted_at: null, status: { in: LIVE_RESERVATION_STATUSES }, check_in_date: dateRange(range), primary_guest_id: { not: null } },
      select: { primary_guest_id: true, nights: true, total_amount: true, currency: true, guests: { select: { first_name: true, last_name: true, phone: true } } },
    })
    const byGuest = new Map<string, RankRow & { guest: string | null; phone: string | null }>()
    for (const r of reservations) {
      const id = r.primary_guest_id!
      let row = byGuest.get(id)
      if (!row) byGuest.set(id, (row = { guest: guestFullName(r.guests), phone: r.guests?.phone ?? null, stays: 0, nights: 0, revenue: new MoneyBag() }))
      row.stays++
      row.nights += r.nights
      row.revenue.add(r.currency, num(r.total_amount), ctx.systemCurrency)
    }
    const rows = rank([...byGuest.entries()].map(([guest_id, row]) => ({ guest_id, ...row })), rankBy, currency)
      .slice(0, args.limit ?? 10)
      .map(({ revenue, ...row }) => ({ ...row, revenue: revenue.toMoney() }))
    return {
      data: { period: range, rank_by: rankBy, ranking_currency: currency, guests_with_stays: byGuest.size, rows },
      blocks: [
        {
          type: 'table',
          title: 'top_guests',
          period: range,
          columns: [
            { key: 'guest', format: 'text' },
            { key: 'phone', format: 'text' },
            { key: 'stays', format: 'number' },
            { key: 'nights', format: 'number' },
            { key: 'revenue', format: 'money_list' },
          ],
          rows,
          totalRows: byGuest.size,
        },
      ],
    }
  },
})

export const getTopCompanies = defineTool({
  name: 'get_top_companies',
  description:
    'Top corporate clients / companies (الشركات / الجهات) by revenue, nights or stays for reservations arriving in a period, with their current unpaid invoice balance.',
  args: z.object(rankArgs),
  async run(args, ctx) {
    const range = period(args, ctx)
    const rankBy = args.rank_by ?? 'revenue'
    const currency = (args.currency ?? ctx.systemCurrency).toUpperCase()
    const reservations = await prisma.reservations.findMany({
      where: { deleted_at: null, status: { in: LIVE_RESERVATION_STATUSES }, check_in_date: dateRange(range), company_id: { not: null } },
      select: { company_id: true, nights: true, room_count: true, total_amount: true, currency: true, contacts: { select: { name: true } } },
    })
    const byCompany = new Map<string, RankRow & { company: string; rooms_booked: number }>()
    for (const r of reservations) {
      const id = r.company_id!
      let row = byCompany.get(id)
      if (!row) byCompany.set(id, (row = { company: r.contacts?.name ?? '', stays: 0, nights: 0, rooms_booked: 0, revenue: new MoneyBag() }))
      row.stays++
      row.nights += r.nights * Math.max(1, r.room_count)
      row.rooms_booked += r.room_count
      row.revenue.add(r.currency, num(r.total_amount), ctx.systemCurrency)
    }
    const ranked = rank([...byCompany.entries()].map(([company_id, row]) => ({ company_id, ...row })), rankBy, currency).slice(0, args.limit ?? 10)
    const outstanding = ranked.length
      ? await prisma.invoices.groupBy({
          by: ['contact_id', 'currency'],
          where: { deleted_at: null, contact_id: { in: ranked.map((r) => r.company_id) }, status: { in: [...OPEN_INVOICE_STATUSES] } },
          _sum: { remaining_balance: true },
        })
      : []
    const rows = ranked.map(({ revenue, ...row }) => ({
      ...row,
      revenue: revenue.toMoney(),
      outstanding: outstanding
        .filter((o) => o.contact_id === row.company_id && num(o._sum.remaining_balance) > 0)
        .map((o) => ({ currency: o.currency, amount: round(num(o._sum.remaining_balance)) })),
    }))
    return {
      data: { period: range, rank_by: rankBy, ranking_currency: currency, companies_with_stays: byCompany.size, rows },
      blocks: [
        {
          type: 'table',
          title: 'top_companies',
          period: range,
          columns: [
            { key: 'company', format: 'text' },
            { key: 'stays', format: 'number' },
            { key: 'rooms_booked', format: 'number' },
            { key: 'room_nights', format: 'number' },
            { key: 'revenue', format: 'money_list' },
            { key: 'outstanding', format: 'money_list' },
          ],
          rows: rows.map(({ nights, ...row }) => ({ ...row, room_nights: nights })),
          totalRows: byCompany.size,
        },
      ],
    }
  },
})
