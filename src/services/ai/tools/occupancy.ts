import 'server-only'

import { z } from 'zod'

import type { KpiItem, ResultBlock } from '@/modules/assistant/types'
import { prisma } from '@/services/db/prisma'

import { addDays, periodArgs } from '../periods'
import { defineTool } from './registry'
import { bounded, countSellableRooms, limitForModel, loadStaySlices, MoneyBag, pct, period, round, sortCurrencies } from './shared'

export const getOccupancy = defineTool({
  name: 'get_occupancy',
  description:
    'Occupancy (نسبة الإشغال) for a period: room-nights sold ÷ room-nights available, plus ADR (average room rate per sold night) and RevPAR per currency. Optional breakdown per day or month.',
  args: z.object({
    ...periodArgs,
    group_by: z.enum(['none', 'day', 'month']).optional().describe('Default: none'),
  }),
  async run(args, ctx) {
    const range = bounded(period(args, ctx))
    const [rooms, slices] = await Promise.all([countSellableRooms(), loadStaySlices(range, ctx.systemCurrency)])
    const available = rooms * range.days
    const sold = slices.reduce((sum, s) => sum + s.nightsInPeriod, 0)

    const revenue = new MoneyBag()
    const nightsByCurrency = new Map<string, number>()
    for (const s of slices) {
      revenue.add(s.currency, s.revenueInPeriod, ctx.systemCurrency)
      nightsByCurrency.set(s.currency, (nightsByCurrency.get(s.currency) ?? 0) + s.nightsInPeriod)
    }
    const perCurrency = sortCurrencies(revenue.currencies(), ctx.systemCurrency).map((currency) => ({
      currency,
      room_revenue: revenue.get(currency),
      adr: nightsByCurrency.get(currency) ? round(revenue.get(currency) / nightsByCurrency.get(currency)!) : null,
      revpar: available ? round(revenue.get(currency) / available) : null,
    }))

    const items: KpiItem[] = [
      { key: 'occupancy_pct', value: pct(sold, available), format: 'percent' },
      { key: 'room_nights_sold', value: sold, format: 'number' },
      { key: 'room_nights_available', value: available, format: 'number' },
      { key: 'rooms', value: rooms, format: 'number' },
      ...perCurrency.flatMap((c): KpiItem[] => [
        { key: 'adr', value: c.adr, format: 'money', currency: c.currency },
        { key: 'revpar', value: c.revpar, format: 'money', currency: c.currency },
      ]),
    ]
    const blocks: ResultBlock[] = [{ type: 'kpi', title: 'occupancy', period: range, items }]

    let breakdown: Array<{ bucket: string; sold: number; available: number; occupancy_pct: number | null }> = []
    const groupBy = args.group_by ?? 'none'
    if (groupBy !== 'none') {
      const soldByBucket = new Map<string, number>()
      for (const s of slices) {
        for (const night of s.nightDates) {
          const key = groupBy === 'month' ? night.slice(0, 7) : night
          soldByBucket.set(key, (soldByBucket.get(key) ?? 0) + 1)
        }
      }
      const daysByBucket = new Map<string, number>()
      for (let i = 0; i < range.days; i++) {
        const day = addDays(range.from, i)
        const key = groupBy === 'month' ? day.slice(0, 7) : day
        daysByBucket.set(key, (daysByBucket.get(key) ?? 0) + 1)
      }
      breakdown = [...daysByBucket].map(([bucket, days]) => {
        const bucketSold = soldByBucket.get(bucket) ?? 0
        return { bucket, sold: bucketSold, available: rooms * days, occupancy_pct: pct(bucketSold, rooms * days) }
      })
      const labelFormat = groupBy === 'month' ? 'text' : 'date'
      blocks.push(
        { type: 'bars', title: 'occupancy_trend', period: range, labelKey: 'bucket', labelFormat, valueKey: 'occupancy_pct', format: 'percent', rows: breakdown },
        {
          type: 'table',
          title: 'occupancy_trend',
          period: range,
          columns: [
            { key: 'bucket', format: labelFormat },
            { key: 'sold', format: 'number' },
            { key: 'available', format: 'number' },
            { key: 'occupancy_pct', format: 'percent' },
          ],
          rows: breakdown,
          totalRows: breakdown.length,
        },
      )
    }

    return {
      data: {
        period: range,
        rooms,
        room_nights_sold: sold,
        room_nights_available: available,
        occupancy_pct: pct(sold, available),
        by_currency: perCurrency,
        breakdown: breakdown.length ? limitForModel(breakdown, 40) : undefined,
      },
      blocks,
    }
  },
})

export const getRevenueByRoomType = defineTool({
  name: 'get_revenue_by_room_type',
  description:
    'Room revenue earned in a period per room type (stays prorated by the nights inside the period), with room-nights sold, ADR and occupancy per type.',
  args: z.object({ ...periodArgs }),
  async run(args, ctx) {
    const range = bounded(period(args, ctx))
    const [slices, roomsByType, types] = await Promise.all([
      loadStaySlices(range, ctx.systemCurrency),
      prisma.rooms.groupBy({ by: ['room_type_id'], where: { deleted_at: null }, _count: { _all: true } }),
      prisma.room_types.findMany({ where: { deleted_at: null }, select: { id: true, name: true } }),
    ])
    const byType = new Map<string, { room_type: string; nights: number; revenue: MoneyBag }>()
    for (const type of types) byType.set(type.id, { room_type: type.name, nights: 0, revenue: new MoneyBag() })
    for (const s of slices) {
      let row = byType.get(s.roomTypeId)
      if (!row) byType.set(s.roomTypeId, (row = { room_type: s.roomTypeName, nights: 0, revenue: new MoneyBag() }))
      row.nights += s.nightsInPeriod
      row.revenue.add(s.currency, s.revenueInPeriod, ctx.systemCurrency)
    }
    const rows = [...byType].map(([typeId, row]) => {
      const roomCount = roomsByType.find((r) => r.room_type_id === typeId)?._count._all ?? 0
      const revenue = row.revenue.toMoney()
      return {
        room_type: row.room_type,
        rooms: roomCount,
        room_nights_sold: row.nights,
        occupancy_pct: pct(row.nights, roomCount * range.days),
        room_revenue: revenue,
        adr: row.nights ? revenue.map((m) => ({ currency: m.currency, amount: round(m.amount / row.nights) })) : [],
      }
    })
    rows.sort((a, b) => b.room_nights_sold - a.room_nights_sold)
    return {
      data: { period: range, rows },
      blocks: [
        { type: 'bars', title: 'room_type_nights', period: range, labelKey: 'room_type', labelFormat: 'text', valueKey: 'room_nights_sold', format: 'number', rows },
        {
          type: 'table',
          title: 'revenue_by_room_type',
          period: range,
          columns: [
            { key: 'room_type', format: 'text' },
            { key: 'rooms', format: 'number' },
            { key: 'room_nights_sold', format: 'number' },
            { key: 'occupancy_pct', format: 'percent' },
            { key: 'room_revenue', format: 'money_list' },
            { key: 'adr', format: 'money_list' },
          ],
          rows,
          totalRows: rows.length,
        },
      ],
    }
  },
})

export const getRoomPerformance = defineTool({
  name: 'get_room_performance',
  description:
    'Per-room results for a period: room-nights sold, occupancy % and room revenue. Use for best/worst performing rooms or "which rooms were empty".',
  args: z.object({
    ...periodArgs,
    order: z.enum(['best', 'worst']).optional().describe('worst = least occupied / lowest / أقل / أضعف. Default: best'),
    limit: z.number().int().min(1).max(100).optional().describe('Default: 15'),
  }),
  async run(args, ctx) {
    const range = bounded(period(args, ctx))
    const [rooms, slices] = await Promise.all([
      prisma.rooms.findMany({ where: { deleted_at: null }, select: { id: true, number: true, floor: true, room_types: { select: { name: true } } } }),
      loadStaySlices(range, ctx.systemCurrency),
    ])
    const stats = new Map(rooms.map((room) => [room.id, { nights: 0, revenue: new MoneyBag() }]))
    for (const s of slices) {
      const stat = stats.get(s.roomId)
      if (!stat) continue
      stat.nights += s.nightsInPeriod
      stat.revenue.add(s.currency, s.revenueInPeriod, ctx.systemCurrency)
    }
    const all = rooms.map((room) => {
      const stat = stats.get(room.id)!
      return {
        room: room.number,
        floor: room.floor,
        room_type: room.room_types.name,
        room_nights_sold: stat.nights,
        occupancy_pct: pct(stat.nights, range.days),
        room_revenue: stat.revenue.toMoney(),
      }
    })
    // Rank by nights, then by revenue in the system currency (currencies are never mixed).
    const revenueOf = (row: (typeof all)[number]) => row.room_revenue.find((m) => m.currency === ctx.systemCurrency)?.amount ?? 0
    const direction = args.order === 'worst' ? 1 : -1
    all.sort((a, b) => direction * (a.room_nights_sold - b.room_nights_sold) || direction * (revenueOf(a) - revenueOf(b)) || a.room.localeCompare(b.room, undefined, { numeric: true }))
    const rows = all.slice(0, args.limit ?? 15)
    return {
      data: { period: range, order: args.order ?? 'best', rooms_total: all.length, rows },
      blocks: [
        {
          type: 'table',
          title: args.order === 'worst' ? 'room_performance_worst' : 'room_performance_best',
          period: range,
          columns: [
            { key: 'room', format: 'text' },
            { key: 'room_type', format: 'text' },
            { key: 'floor', format: 'number' },
            { key: 'room_nights_sold', format: 'number' },
            { key: 'occupancy_pct', format: 'percent' },
            { key: 'room_revenue', format: 'money_list' },
          ],
          rows,
          totalRows: all.length,
        },
      ],
    }
  },
})

export const getRoomStatus = defineTool({
  name: 'get_room_status',
  description:
    'Current live state of the rooms right now: occupied/vacant, housekeeping (clean, dirty, cleaning, inspected) and operational status (active, maintenance, out_of_order, blocked).',
  args: z.object({
    filter: z.enum(['attention', 'all', 'occupied', 'vacant', 'dirty', 'out_of_service']).optional().describe('Which rooms to list. Default: attention (dirty, cleaning or not active)'),
  }),
  async run(args) {
    const rooms = await prisma.rooms.findMany({
      where: { deleted_at: null },
      select: { number: true, floor: true, occupancy_status: true, housekeeping_status: true, operational_status: true, room_types: { select: { name: true } } },
      orderBy: { number: 'asc' },
    })
    const isDirty = (r: (typeof rooms)[number]) => r.housekeeping_status === 'dirty' || r.housekeeping_status === 'cleaning'
    const outOfService = (r: (typeof rooms)[number]) => r.operational_status !== 'active'
    const filter = args.filter ?? 'attention'
    const listed = rooms.filter((r) =>
      filter === 'all'
        ? true
        : filter === 'occupied'
          ? r.occupancy_status === 'occupied'
          : filter === 'vacant'
            ? r.occupancy_status === 'vacant'
            : filter === 'dirty'
              ? isDirty(r)
              : filter === 'out_of_service'
                ? outOfService(r)
                : isDirty(r) || outOfService(r),
    )
    listed.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
    const counts = {
      rooms: rooms.length,
      occupied: rooms.filter((r) => r.occupancy_status === 'occupied').length,
      vacant: rooms.filter((r) => r.occupancy_status === 'vacant').length,
      dirty: rooms.filter(isDirty).length,
      out_of_service: rooms.filter(outOfService).length,
    }
    const rows = listed.map((r) => ({
      room: r.number,
      room_type: r.room_types.name,
      floor: r.floor,
      occupancy_status: r.occupancy_status,
      housekeeping_status: r.housekeeping_status,
      operational_status: r.operational_status,
    }))
    return {
      data: { counts, filter, rooms: limitForModel(rows, 40) },
      blocks: [
        {
          type: 'kpi',
          title: 'room_status',
          items: [
            { key: 'rooms', value: counts.rooms, format: 'number' },
            { key: 'occupied', value: counts.occupied, format: 'number' },
            { key: 'vacant', value: counts.vacant, format: 'number' },
            { key: 'dirty', value: counts.dirty, format: 'number' },
            { key: 'out_of_service', value: counts.out_of_service, format: 'number' },
          ],
        },
        {
          type: 'table',
          title: `room_status_${filter}`,
          columns: [
            { key: 'room', format: 'text' },
            { key: 'room_type', format: 'text' },
            { key: 'floor', format: 'number' },
            { key: 'occupancy_status', format: 'enum' },
            { key: 'housekeeping_status', format: 'enum' },
            { key: 'operational_status', format: 'enum' },
          ],
          rows,
          totalRows: rows.length,
        },
      ],
    }
  },
})
